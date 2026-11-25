/* app/admin/vendors/page.js
 * Vendor Management Portal
 *
 * Admin creates catering vendor records and vendor portal accounts,
 * activates/suspends vendor accounts, and monitors vendor packages.
 */

"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserProfile } from "@/lib/auth";
import styles from "./vendors.module.css";

export default function VendorsPage() {
  const toast = useToast();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [vendorPackages, setVendorPackages] = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmVendor, setConfirmVendor] = useState(null);

  const [formData, setFormData] = useState({
    business_name: "",
    license_number: "",
    station_location: "",
    contact_name: "",
    phone: "",
    email: "",
    create_login: true,
    login_password: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Vendor portal login provisioning state (for existing unlinked vendors)
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
            package_name,
            approval_status
          )
        `)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setVendors(data);
      }
    } catch (err) {
      console.error("Error loading vendors:", err);
      toast.error("Failed to load vendors.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadVendors();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateVendor(e) {
    e.preventDefault();
    if (formData.create_login) {
      if (!formData.email.trim()) {
        toast.error("Vendor email is required to create portal login credentials.");
        return;
      }
      if (!formData.login_password || formData.login_password.length < 6) {
        toast.error("Initial password must be at least 6 characters.");
        return;
      }
    }

    setSubmitting(true);
    const supabase = createClient();
    if (!supabase) {
      toast.error("Please configure Supabase credentials in .env.local first.");
      setSubmitting(false);
      return;
    }

    try {
      const authData = await getCurrentUserProfile();

      const { data: createdVendor, error } = await supabase
        .from("vendors")
        .insert([
          {
            business_name: formData.business_name.trim(),
            license_number: formData.license_number.trim(),
            station_location: formData.station_location.trim(),
            contact_name: formData.contact_name.trim() || null,
            phone: formData.phone.trim() || null,
            email: formData.email.trim() || null,
            status: "active",
          },
        ])
        .select()
        .single();

      if (error) throw error;

      await supabase.from("audit_logs").insert([
        {
          user_id: authData?.user?.id || null,
          action: "REGISTER_VENDOR",
          target_entity: "vendor",
          details: {
            vendor_id: createdVendor.id,
            business_name: createdVendor.business_name,
            license_number: createdVendor.license_number,
            station_location: createdVendor.station_location,
          },
        },
      ]);

      if (formData.create_login) {
        const res = await fetch("/api/admin/create-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email.trim(),
            password: formData.login_password,
            full_name: formData.contact_name.trim() || formData.business_name.trim(),
            phone: formData.phone.trim() || null,
            role: "vendor",
            vendor_id: createdVendor.id,
          }),
        });
        const accData = await res.json();
        if (!res.ok) {
          toast.warning(
            `Vendor created, but portal login setup failed: ${accData.error || "Unknown error"}. You can provision login from the vendor details modal.`
          );
        } else {
          toast.success("Vendor registered and portal login account created.");
        }
      } else {
        toast.success("Catering vendor registered successfully.");
      }

      setFormData({
        business_name: "",
        license_number: "",
        station_location: "",
        contact_name: "",
        phone: "",
        email: "",
        create_login: true,
        login_password: "",
      });
      setModalOpen(false);
      loadVendors();
    } catch (err) {
      toast.error("Error adding vendor: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmToggleStatus() {
    if (!confirmVendor) return;
    const nextStatus = confirmVendor.status === "active" ? "suspended" : "active";
    setActionLoading(true);

    try {
      const res = await fetch("/api/admin/toggle-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "vendor",
          entityId: confirmVendor.id,
          nextStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update vendor status.");

      toast.success(
        nextStatus === "suspended"
          ? `Vendor "${confirmVendor.business_name}" suspended. Their portal login and QR codes are now disabled.`
          : `Vendor "${confirmVendor.business_name}" reactivated.`
      );
      setConfirmVendor(null);
      loadVendors();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  }

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
      const { data, error } = await supabase
        .from("food_packages")
        .select(`
          id,
          package_name,
          category,
          price,
          status,
          approval_status,
          created_at,
          qr_codes (
            qr_token,
            is_active
          )
        `)
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false });

      setVendorPackages(!error && data ? data : []);
    } catch (err) {
      console.error("Error fetching packages:", err);
      setVendorPackages([]);
    } finally {
      setPackagesLoading(false);
    }
  }

  const filtered = vendors.filter((v) => {
    const term = search.toLowerCase();
    const matchesSearch =
      !term ||
      v.business_name?.toLowerCase().includes(term) ||
      v.license_number?.toLowerCase().includes(term) ||
      v.station_location?.toLowerCase().includes(term) ||
      v.contact_name?.toLowerCase().includes(term);
    const matchesStatus = statusFilter === "all" || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AdminLayout title="Vendor Account Management">
      <div className={styles.container}>
        <div className={styles.topBar}>
          <div style={{ display: "flex", gap: "10px", flex: 1, flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Search vendors by name, station, license..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.search}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: "9px 12px",
                border: "1.5px solid var(--border)",
                borderRadius: "8px",
                background: "var(--surface)",
                fontSize: "0.875rem",
              }}
            >
              <option value="all">All Vendors ({vendors.length})</option>
              <option value="active">Active ({vendors.filter((v) => v.status === "active").length})</option>
              <option value="suspended">Suspended ({vendors.filter((v) => v.status === "suspended").length})</option>
            </select>
          </div>
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            + Create Vendor Account
          </Button>
        </div>

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
                ? "No catering vendors have been registered yet. Create a Vendor account so they can upload food packages and generate QR codes."
                : "No registered vendors match your search or filter."
            }
            action={
              <Button variant="primary" onClick={() => setModalOpen(true)}>
                + Create First Vendor Account
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
                  <span className={`${styles.statusPill} ${styles[v.status] || styles.active}`}>
                    {v.status || "active"}
                  </span>
                </div>

                <div className={styles.contactRow}>
                  <span><strong>Station:</strong> {v.station_location || "Not specified"}</span>
                  {v.contact_name && <span>Contact: {v.contact_name}</span>}
                  {v.phone && <span>Phone: {v.phone}</span>}
                  {v.email && <span>Email: {v.email}</span>}
                  <span>Uploaded Packages: <strong>{v.food_packages?.length || 0}</strong></span>
                  <span>
                    Portal Access:{" "}
                    <strong style={{ color: v.owner_user_id ? "#166534" : "#b45309" }}>
                      {v.owner_user_id ? "Provisioned" : "Not provisioned"}
                    </strong>
                  </span>
                </div>

                <div className={styles.cardFooter}>
                  <button className={styles.footerBtn} onClick={() => handleViewDetails(v)}>
                    Packages & Account →
                  </button>

                  <button
                    className={styles.footerBtn}
                    style={{
                      color: v.status === "active" ? "#dc2626" : "#16a34a",
                      fontSize: "0.75rem",
                    }}
                    onClick={() => setConfirmVendor(v)}
                    disabled={actionLoading}
                  >
                    {v.status === "active" ? "Suspend Vendor" : "Activate Vendor"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Create Vendor Account */}
        {modalOpen && (
          <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h2 className={styles.modalTitle}>Create Catering Vendor Account</h2>
              <form onSubmit={handleCreateVendor}>
                <div className={styles.formGroup}>
                  <label>Catering Agency / Business Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.business_name}
                    onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                    placeholder="e.g. Northern Railways Catering Services"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Station / Base Location *</label>
                  <input
                    type="text"
                    required
                    value={formData.station_location}
                    onChange={(e) => setFormData({ ...formData, station_location: e.target.value })}
                    placeholder="e.g. New Delhi Railway Station (NDLS)"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>FSSAI / Railway License Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.license_number}
                    onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                    placeholder="e.g. FSSAI-2025-09871"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Contact Person</label>
                  <input
                    type="text"
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    placeholder="e.g. Rajesh Kumar"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Vendor Email Address {formData.create_login ? "*" : ""}</label>
                  <input
                    type="email"
                    required={formData.create_login}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="vendor@pantryservices.com"
                  />
                </div>

                <div style={{ padding: "10px 12px", background: "#f8fafc", border: "1px solid var(--border)", borderRadius: "8px", marginBottom: "14px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={formData.create_login}
                      onChange={(e) => setFormData({ ...formData, create_login: e.target.checked })}
                    />
                    Also create Vendor Portal login credentials now
                  </label>

                  {formData.create_login && (
                    <div className={styles.formGroup} style={{ marginTop: "10px", marginBottom: 0 }}>
                      <label>Initial Portal Password * (Min 6 chars)</label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={formData.login_password}
                        onChange={(e) => setFormData({ ...formData, login_password: e.target.value })}
                        placeholder="••••••••"
                      />
                    </div>
                  )}
                </div>

                <div className={styles.modalActions}>
                  <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={submitting}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" loading={submitting}>
                    Create Vendor Account
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: View Vendor Details & Packages */}
        {selectedVendor && (
          <div className={styles.modalOverlay} onClick={() => setSelectedVendor(null)}>
            <div className={styles.modal} style={{ maxWidth: "620px" }} onClick={(e) => e.stopPropagation()}>
              <h2 className={styles.modalTitle}>{selectedVendor.business_name}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.85rem", marginBottom: "16px" }}>
                <div><strong>Station Base:</strong> {selectedVendor.station_location}</div>
                <div><strong>License:</strong> {selectedVendor.license_number}</div>
                {selectedVendor.contact_name && <div><strong>Contact:</strong> {selectedVendor.contact_name}</div>}
                {selectedVendor.phone && <div><strong>Phone:</strong> {selectedVendor.phone}</div>}
                {selectedVendor.email && <div><strong>Email:</strong> {selectedVendor.email}</div>}
                <div>
                  Status:{" "}
                  <strong style={{ color: selectedVendor.status === "active" ? "#16a34a" : "#dc2626" }}>
                    {selectedVendor.status?.toUpperCase()}
                  </strong>
                </div>
              </div>

              <h3 style={{ fontSize: "0.95rem", fontWeight: 700, borderTop: "1px solid var(--border)", paddingTop: "12px", marginBottom: "10px" }}>
                Uploaded Food Packages ({vendorPackages.length})
              </h3>

              {packagesLoading ? (
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Loading food packages...</p>
              ) : vendorPackages.length === 0 ? (
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                  This vendor has not uploaded any food packages yet.
                </p>
              ) : (
                <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                  {vendorPackages.map((pkg) => {
                    const qr = Array.isArray(pkg.qr_codes) ? pkg.qr_codes[0] : pkg.qr_codes;
                    return (
                      <div key={pkg.id} style={{ padding: "8px 12px", background: "#f8fafc", border: "1px solid var(--border)", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem" }}>
                        <div>
                          <strong>{pkg.package_name}</strong> ({pkg.category || "Meal"})
                          {pkg.price != null && <span style={{ marginLeft: "6px", color: "var(--text-muted)" }}>• ₹{pkg.price}</span>}
                          <span style={{ marginLeft: "8px", fontSize: "0.75rem", fontWeight: 600, color: pkg.approval_status === "approved" ? "#166534" : pkg.approval_status === "rejected" ? "#991b1b" : "#92400e" }}>
                            [{pkg.approval_status || "pending"}]
                          </span>
                        </div>
                        <span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "var(--navy)" }}>
                          {qr?.qr_token ? `${qr.qr_token.slice(0, 8)}…` : "No QR"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

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
                        toast.error("Password must be at least 6 characters.");
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
                        toast.success(`Vendor login created for "${selectedVendor.business_name}".`);
                        setSelectedVendor({ ...selectedVendor, owner_user_id: data.userId });
                        setLoginPassword("");
                        loadVendors();
                      } catch (err) {
                        toast.error("Error creating vendor login: " + err.message);
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

        <ConfirmDialog
          open={Boolean(confirmVendor)}
          title={confirmVendor?.status === "active" ? "Suspend Vendor Account?" : "Reactivate Vendor Account?"}
          message={
            confirmVendor?.status === "active"
              ? `Suspending "${confirmVendor?.business_name}" will immediately disable their portal login and block all their active food packages and QR codes from public scanning.`
              : `Reactivating "${confirmVendor?.business_name}" will restore their vendor portal login and allow approved packages to be scanned.`
          }
          confirmLabel={confirmVendor?.status === "active" ? "Suspend Vendor" : "Activate Vendor"}
          variant={confirmVendor?.status === "active" ? "danger" : "primary"}
          loading={actionLoading}
          onConfirm={confirmToggleStatus}
          onCancel={() => setConfirmVendor(null)}
        />
      </div>
    </AdminLayout>
  );
}
