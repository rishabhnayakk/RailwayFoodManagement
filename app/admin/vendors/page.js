/* app/admin/vendors/page.js
 * Vendor Management Portal
 *
 * Railway quality administration monitors all licensed catering & food contractors
 * and can provision vendor portal login credentials linked via owner_user_id.
 * Connects to Supabase `vendors` table. Shows real empty states.
 * NO mock records. NO external icon library.
 */

"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserProfile } from "@/lib/auth";
import styles from "./vendors.module.css";

export default function VendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [vendorPackages, setVendorPackages] = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [formData, setFormData] = useState({
    business_name: "",
    license_number: "",
    station_location: "",
    contact_name: "",
    phone: "",
    email: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Vendor portal login provisioning state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [creatingLogin, setCreatingLogin] = useState(false);

  async function loadVendors() {
    setLoading(true);
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("vendors")
        .select(`
          *,
          food_packages (
            id,
            package_name
          )
        `)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setVendors(data);
      }
    } catch (err) {
      console.error("Error loading vendors:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadVendors();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  async function handleCreateVendor(e) {
    e.preventDefault();
    setSubmitting(true);
    const supabase = createClient();
    if (!supabase) {
      alert("Please configure Supabase credentials in .env.local first.");
      setSubmitting(false);
      return;
    }

    try {
      const authData = await getCurrentUserProfile();

      const { data, error } = await supabase.from("vendors").insert([
        {
          business_name: formData.business_name.trim(),
          license_number: formData.license_number.trim(),
          station_location: formData.station_location.trim(),
          contact_name: formData.contact_name.trim() || null,
          phone: formData.phone.trim() || null,
          email: formData.email.trim() || null,
          status: "active",
        },
      ]).select().single();

      if (error) throw error;

      // Log action in audit_logs
      await supabase.from("audit_logs").insert([
        {
          user_id: authData?.user?.id || null,
          action: "REGISTER_VENDOR",
          target_entity: "vendor",
          details: {
            vendor_id: data.id,
            business_name: data.business_name,
            license_number: data.license_number,
            station_location: data.station_location,
          },
        },
      ]);

      setFormData({
        business_name: "",
        license_number: "",
        station_location: "",
        contact_name: "",
        phone: "",
        email: "",
      });
      setModalOpen(false);
      alert("Catering contractor registered successfully.");
      loadVendors();
    } catch (err) {
      alert("Error adding vendor: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Toggle Vendor Active / Suspended status
  async function handleToggleStatus(vendor) {
    const newStatus = vendor.status === "active" ? "suspended" : "active";
    const confirmMsg =
      newStatus === "suspended"
        ? `Are you sure you want to suspend "${vendor.business_name}"? Suspended vendors cannot be assigned to new packages.`
        : `Reactivate vendor "${vendor.business_name}"?`;

    if (!confirm(confirmMsg)) return;

    setActionLoading(true);
    const supabase = createClient();
    if (!supabase) return;

    try {
      const authData = await getCurrentUserProfile();

      const { error } = await supabase
        .from("vendors")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", vendor.id);

      if (error) throw error;

      // Audit log
      await supabase.from("audit_logs").insert([
        {
          user_id: authData?.user?.id || null,
          action: newStatus === "suspended" ? "SUSPEND_VENDOR" : "ACTIVATE_VENDOR",
          target_entity: "vendor",
          details: {
            vendor_id: vendor.id,
            business_name: vendor.business_name,
            new_status: newStatus,
          },
        },
      ]);

      loadVendors();
    } catch (err) {
      alert("Error updating status: " + err.message);
    } finally {
      setActionLoading(false);
    }
  }

  // View vendor details & packages
  async function handleViewDetails(vendor) {
    setSelectedVendor(vendor);
    setLoginEmail(vendor.email || "");
    setLoginPassword("");
    setPackagesLoading(true);

    const supabase = createClient();
    if (!supabase) {
      setPackagesLoading(false);
      return;
    }

    try {
      // food_packages does NOT have a qr_token column; it lives in the qr_codes table.
      // We join qr_codes to get the token for each package.
      const { data, error } = await supabase
        .from("food_packages")
        .select(`
          id,
          package_name,
          category,
          price,
          status,
          created_at,
          qr_codes (
            qr_token,
            is_active
          )
        `)
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setVendorPackages(data);
      } else {
        setVendorPackages([]);
      }
    } catch (err) {
      console.error("Error fetching packages:", err);
    } finally {
      setPackagesLoading(false);
    }
  }

  const filtered = vendors.filter((v) => {
    const term = search.toLowerCase();
    return (
      !term ||
      v.business_name?.toLowerCase().includes(term) ||
      v.license_number?.toLowerCase().includes(term) ||
      v.station_location?.toLowerCase().includes(term) ||
      v.contact_name?.toLowerCase().includes(term)
    );
  });

  return (
    <AdminLayout title="Food Vendor & Contractor Management">
      <div className={styles.container}>
        {/* Top Control Bar */}
        <div className={styles.topBar}>
          <input
            type="text"
            placeholder="Search vendors by name, station, license..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.search}
          />
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            + Register Catering Vendor
          </Button>
        </div>

        {/* Vendors Grid */}
        {loading ? (
          <div className={styles.grid}>
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="🏪"
            title="No vendors found"
            description={
              vendors.length === 0
                ? "No food vendors have been registered yet. Add authorized railway catering contractors to link with food packages and quality audits."
                : "No registered vendors match your search term."
            }
            action={
              <Button variant="primary" onClick={() => setModalOpen(true)}>
                + Register First Vendor
              </Button>
            }
          />
        ) : (
          <div className={styles.grid}>
            {filtered.map((v) => (
              <div key={v.id} className={styles.vendorCard}>
                <div className={styles.cardHead}>
                  <div>
                    <h3 className={styles.vendorName}>{v.business_name}</h3>
                    <span className={styles.license}>Lic: {v.license_number || "—"}</span>
                  </div>
                  <span
                    className={`${styles.statusPill} ${
                      styles[v.status] || styles.active
                    }`}
                  >
                    {v.status || "active"}
                  </span>
                </div>

                <div className={styles.contactRow}>
                  <span>📍 <strong>Station:</strong> {v.station_location || "Not specified"}</span>
                  {v.contact_name && <span>👤 Contact: {v.contact_name}</span>}
                  {v.phone && <span>📞 Phone: {v.phone}</span>}
                  {v.email && <span>✉️ Email: {v.email}</span>}
                  <span>📦 Authorized Packages: <strong>{v.food_packages?.length || 0}</strong></span>
                </div>

                <div className={styles.cardFooter}>
                  <button
                    className={styles.footerBtn}
                    onClick={() => handleViewDetails(v)}
                  >
                    Packages & Profile →
                  </button>

                  <button
                    className={styles.footerBtn}
                    style={{
                      color: v.status === "active" ? "#dc2626" : "#16a34a",
                      fontSize: "0.75rem",
                    }}
                    onClick={() => handleToggleStatus(v)}
                    disabled={actionLoading}
                  >
                    {v.status === "active" ? "Suspend" : "Reactivate"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Add Vendor */}
        {modalOpen && (
          <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h2 className={styles.modalTitle}>Register Railway Food Vendor</h2>
              <form onSubmit={handleCreateVendor}>
                <div className={styles.formGroup}>
                  <label>Catering Agency / Business Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.business_name}
                    onChange={(e) =>
                      setFormData({ ...formData, business_name: e.target.value })
                    }
                    placeholder="e.g. Northern Railways Catering Services"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Station / Base Location *</label>
                  <input
                    type="text"
                    required
                    value={formData.station_location}
                    onChange={(e) =>
                      setFormData({ ...formData, station_location: e.target.value })
                    }
                    placeholder="e.g. New Delhi Railway Station (NDLS)"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>FSSAI / Railway License Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.license_number}
                    onChange={(e) =>
                      setFormData({ ...formData, license_number: e.target.value })
                    }
                    placeholder="e.g. FSSAI-2025-09871"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Contact Person</label>
                  <input
                    type="text"
                    value={formData.contact_name}
                    onChange={(e) =>
                      setFormData({ ...formData, contact_name: e.target.value })
                    }
                    placeholder="e.g. Rajesh Kumar"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="vendor@pantryservices.com"
                  />
                </div>
                <div className={styles.modalActions}>
                  <Button
                    variant="ghost"
                    onClick={() => setModalOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" loading={submitting}>
                    Save Vendor
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: View Vendor Details & Packages */}
        {selectedVendor && (
          <div className={styles.modalOverlay} onClick={() => setSelectedVendor(null)}>
            <div className={styles.modal} style={{ maxWidth: "600px" }} onClick={(e) => e.stopPropagation()}>
              <h2 className={styles.modalTitle}>{selectedVendor.business_name}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.85rem", marginBottom: "16px" }}>
                <div>📍 <strong>Station Base:</strong> {selectedVendor.station_location}</div>
                <div>📜 <strong>License:</strong> {selectedVendor.license_number}</div>
                {selectedVendor.contact_name && <div>👤 <strong>Contact:</strong> {selectedVendor.contact_name}</div>}
                {selectedVendor.phone && <div>📞 <strong>Phone:</strong> {selectedVendor.phone}</div>}
                {selectedVendor.email && <div>✉️ <strong>Email:</strong> {selectedVendor.email}</div>}
                <div>Status: <strong style={{ color: selectedVendor.status === "active" ? "#16a34a" : "#dc2626" }}>{selectedVendor.status?.toUpperCase()}</strong></div>
              </div>

              <h3 style={{ fontSize: "0.95rem", fontWeight: 700, borderTop: "1px solid var(--border)", paddingTop: "12px", marginBottom: "10px" }}>
                Authorized Food Packages ({vendorPackages.length})
              </h3>

              {packagesLoading ? (
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Loading food packages...</p>
              ) : vendorPackages.length === 0 ? (
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                  No food packages registered under this vendor yet. Register a package in QR Packages to link it.
                </p>
              ) : (
                <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                  {vendorPackages.map((pkg) => (
                    <div key={pkg.id} style={{ padding: "8px 12px", background: "#f8fafc", border: "1px solid var(--border)", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem" }}>
                      <div>
                        <strong>{pkg.package_name}</strong> ({pkg.category || "Meal"})
                        {pkg.price && <span style={{ marginLeft: "6px", color: "var(--text-muted)" }}>• ₹{pkg.price}</span>}
                      </div>
                      <span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "var(--navy)" }}>
                        {pkg.qr_codes?.[0]?.qr_token ? `${pkg.qr_codes[0].qr_token.slice(0, 8)}…` : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Vendor Portal Access Provisioning */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px", marginTop: "14px" }}>
                <h3 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: "8px" }}>
                  Vendor Portal Login Access
                </h3>
                {selectedVendor.owner_user_id ? (
                  <p style={{ fontSize: "0.82rem", color: "#166534", fontWeight: 600 }}>
                    ✓ Portal login account linked (User ID: {selectedVendor.owner_user_id.slice(0, 8)}…)
                  </p>
                ) : (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!loginPassword || loginPassword.length < 6) {
                        alert("Password must be at least 6 characters.");
                        return;
                      }
                      setCreatingLogin(true);
                      try {
                        const res = await fetch("/api/admin/create-account", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            email: loginEmail.trim(),
                            password: loginPassword,
                            full_name: selectedVendor.contact_name || selectedVendor.business_name,
                            phone: selectedVendor.phone || null,
                            role: "vendor",
                            vendor_id: selectedVendor.id,
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || "Failed to provision vendor login.");
                        alert(`Vendor login created for "${selectedVendor.business_name}". They can sign in at /auth/login.`);
                        setSelectedVendor({ ...selectedVendor, owner_user_id: data.userId });
                        setLoginPassword("");
                        loadVendors();
                      } catch (err) {
                        alert("Error creating vendor login: " + err.message);
                      } finally {
                        setCreatingLogin(false);
                      }
                    }}
                    style={{ display: "flex", flexDirection: "column", gap: "8px" }}
                  >
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="Vendor login email"
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "0.85rem" }}
                    />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Initial password (min 6 chars)"
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "0.85rem" }}
                    />
                    <Button type="submit" variant="outline" loading={creatingLogin}>
                      + Provision Vendor Portal Login
                    </Button>
                  </form>
                )}
              </div>

              <div className={styles.modalActions} style={{ marginTop: "16px" }}>
                <Button variant="primary" onClick={() => setSelectedVendor(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
