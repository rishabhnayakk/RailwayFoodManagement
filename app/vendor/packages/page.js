/* app/vendor/packages/page.js
 * Vendor Food Packages & QR Codes Management
 *
 * Allows authenticated vendors to:
 * - View all food packages belonging to their own catering business
 * - Add new food packages (under Admin-approved vendor account)
 * - Edit package details (name, category, price, description)
 * - Activate / Deactivate their own food packages
 * - View & download QR codes generated for their packages
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import VendorLayout from "@/components/layout/VendorLayout";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserProfile } from "@/lib/auth";
import styles from "../vendor.module.css";

export default function VendorPackagesPage() {
  const router = useRouter();
  const [vendor, setVendor] = useState(null);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add / Edit package modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    package_name: "",
    category: "Meals",
    price: "",
    description: "",
  });

  // QR modal
  const [qrPkg, setQrPkg] = useState(null);
  const [qrUrl, setQrUrl] = useState("");

  async function loadPackages() {
    setLoading(true);
    setError("");
    try {
      const account = await getCurrentUserProfile();
      if (!account?.profile || account.profile.role !== "vendor") {
        router.replace("/auth/login");
        return;
      }

      const supabase = createClient();
      if (!supabase) throw new Error("Supabase is not configured.");

      const { data: vendorData, error: vErr } = await supabase
        .from("vendors")
        .select("*")
        .eq("owner_user_id", account.user.id)
        .single();

      if (vErr || !vendorData) {
        throw new Error("No vendor profile is linked to your account. Contact Admin.");
      }
      setVendor(vendorData);

      const { data: pkgData, error: pkgErr } = await supabase
        .from("food_packages")
        .select(`
          id,
          package_name,
          category,
          description,
          price,
          status,
          created_at,
          qr_codes (
            id,
            qr_token,
            is_active
          )
        `)
        .eq("vendor_id", vendorData.id)
        .order("created_at", { ascending: false });

      if (pkgErr) throw pkgErr;
      setPackages(pkgData || []);
    } catch (e) {
      setError(e.message || "Failed to load packages.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPackages();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  function openAddModal() {
    setEditingPkg(null);
    setFormData({ package_name: "", category: "Meals", price: "", description: "" });
    setModalOpen(true);
  }

  function openEditModal(pkg) {
    setEditingPkg(pkg);
    setFormData({
      package_name: pkg.package_name || "",
      category: pkg.category || "Meals",
      price: pkg.price != null ? String(pkg.price) : "",
      description: pkg.description || "",
    });
    setModalOpen(true);
  }

  async function handleSavePackage(e) {
    e.preventDefault();
    if (!vendor) return;
    setSubmitting(true);

    try {
      const supabase = createClient();
      const payload = {
        package_name: formData.package_name.trim(),
        category: formData.category.trim() || "Meals",
        price: formData.price ? parseFloat(formData.price) : null,
        description: formData.description.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editingPkg) {
        const { error: upErr } = await supabase
          .from("food_packages")
          .update(payload)
          .eq("id", editingPkg.id);
        if (upErr) throw upErr;
      } else {
        const { error: insErr } = await supabase.from("food_packages").insert([
          {
            ...payload,
            vendor_id: vendor.id,
            status: "active",
          },
        ]);
        if (insErr) throw insErr;
      }

      setModalOpen(false);
      await loadPackages();
    } catch (e) {
      alert("Error saving package: " + e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(pkg) {
    const nextStatus = pkg.status === "active" ? "inactive" : "active";
    const ok = confirm(
      nextStatus === "inactive"
        ? `Deactivate "${pkg.package_name}"? Passengers scanning its QR code will see it as inactive.`
        : `Reactivate "${pkg.package_name}"?`
    );
    if (!ok) return;

    const supabase = createClient();
    const { error: upErr } = await supabase
      .from("food_packages")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", pkg.id);

    if (upErr) {
      alert("Failed to update status: " + upErr.message);
      return;
    }

    setPackages((prev) =>
      prev.map((p) => (p.id === pkg.id ? { ...p, status: nextStatus } : p))
    );
  }

  async function handleViewQr(pkg) {
    const qrRecord = Array.isArray(pkg.qr_codes) ? pkg.qr_codes[0] : pkg.qr_codes;
    if (!qrRecord?.qr_token) {
      alert("No QR code generated yet for this package. Ask RailGuard Admin to generate a verified QR code.");
      return;
    }

    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const scanLink = `${origin}/scan/${qrRecord.qr_token}`;
      const dataUrl = await QRCode.toDataURL(scanLink, { width: 280, margin: 2 });
      setQrPkg({ ...pkg, qrToken: qrRecord.qr_token, qrActive: qrRecord.is_active });
      setQrUrl(dataUrl);
    } catch (e) {
      alert("Could not render QR image: " + e.message);
    }
  }

  return (
    <VendorLayout title="My Food Packages">
      {loading ? (
        <div className={styles.loading}>Loading your food packages…</div>
      ) : error ? (
        <div className={styles.errorBox} role="alert">
          <strong>⚠️ {error}</strong>
        </div>
      ) : (
        <div className={styles.page}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Managing packages for <strong>{vendor?.business_name}</strong> ({packages.length} total)
            </p>
            <Button variant="primary" onClick={openAddModal}>
              + Add Food Package
            </Button>
          </div>

          {packages.length === 0 ? (
            <EmptyState
              icon="📦"
              title="No food packages yet"
              description="Add your catering meal packages here. RailGuard Admin can then generate verified QR codes for passenger scanning."
              action={
                <Button variant="primary" onClick={openAddModal}>
                  + Add First Package
                </Button>
              }
            />
          ) : (
            <section className={styles.section}>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Package Name</th>
                      <th>Category</th>
                      <th>Tariff</th>
                      <th>Status</th>
                      <th>QR Code</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packages.map((pkg) => {
                      const qrRecord = Array.isArray(pkg.qr_codes) ? pkg.qr_codes[0] : pkg.qr_codes;
                      return (
                        <tr key={pkg.id}>
                          <td>
                            <div className={styles.bold}>{pkg.package_name}</div>
                            {pkg.description && (
                              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                {pkg.description}
                              </div>
                            )}
                          </td>
                          <td>{pkg.category || "Meals"}</td>
                          <td>{pkg.price != null ? `₹${Number(pkg.price).toFixed(2)}` : "—"}</td>
                          <td>
                            <span className={pkg.status === "active" ? styles.badgeGreen : styles.badgeRed}>
                              {pkg.status}
                            </span>
                          </td>
                          <td>
                            {qrRecord?.qr_token ? (
                              <button
                                onClick={() => handleViewQr(pkg)}
                                style={{
                                  background: "#e8f0fb",
                                  color: "#0f2a52",
                                  border: "1px solid #bfdbfe",
                                  borderRadius: "6px",
                                  padding: "4px 10px",
                                  fontSize: "0.78rem",
                                  fontWeight: 600,
                                }}
                              >
                                📱 View QR
                              </button>
                            ) : (
                              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                                Pending Admin QR
                              </span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "8px" }}>
                              <Button variant="outline" size="sm" onClick={() => openEditModal(pkg)}>
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleStatus(pkg)}
                              >
                                {pkg.status === "active" ? "Deactivate" : "Activate"}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Add / Edit Modal */}
          {modalOpen && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 100,
                padding: "16px",
              }}
              onClick={() => setModalOpen(false)}
            >
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "12px",
                  padding: "24px",
                  width: "100%",
                  maxWidth: "460px",
                  boxShadow: "var(--shadow-lg)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h2 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "16px" }}>
                  {editingPkg ? "Edit Food Package" : "Add Food Package"}
                </h2>
                <form onSubmit={handleSavePackage} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                      Package Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.package_name}
                      onChange={(e) => setFormData({ ...formData, package_name: e.target.value })}
                      placeholder="e.g. Standard Veg Thali"
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "6px" }}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                        Category
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "6px" }}
                      >
                        <option value="Meals">Meals</option>
                        <option value="Breakfast">Breakfast</option>
                        <option value="Snacks">Snacks</option>
                        <option value="Beverages">Beverages</option>
                        <option value="Combo">Combo</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                        Tariff Price (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        placeholder="80.00"
                        style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "6px" }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                      Description
                    </label>
                    <textarea
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Menu contents, serving weight, allergens..."
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "6px" }}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                    <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={submitting}>
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary" loading={submitting}>
                      {editingPkg ? "Save Changes" : "Create Package"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* QR View / Download Modal */}
          {qrPkg && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 100,
                padding: "16px",
              }}
              onClick={() => setQrPkg(null)}
            >
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "12px",
                  padding: "24px",
                  width: "100%",
                  maxWidth: "380px",
                  textAlign: "center",
                  boxShadow: "var(--shadow-lg)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "6px" }}>
                  {qrPkg.package_name}
                </h3>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "14px" }}>
                  QR Status: {qrPkg.qrActive ? "Active" : "Deactivated by Admin"}
                </p>
                {qrUrl && (
                  <img
                    src={qrUrl}
                    alt={`QR for ${qrPkg.package_name}`}
                    style={{ width: "220px", height: "220px", margin: "0 auto 12px", borderRadius: "8px", border: "1px solid var(--border)" }}
                  />
                )}
                <p style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "var(--text-muted)", wordBreak: "break-all", marginBottom: "16px" }}>
                  Token: {qrPkg.qrToken}
                </p>
                <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                  {qrUrl && (
                    <a
                      href={qrUrl}
                      download={`railguard-qr-${qrPkg.package_name.toLowerCase().replace(/\s+/g, "-")}.png`}
                      style={{
                        background: "var(--navy)",
                        color: "#ffffff",
                        padding: "8px 16px",
                        borderRadius: "6px",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                      }}
                    >
                      ⬇ Download PNG
                    </a>
                  )}
                  <Button variant="ghost" onClick={() => setQrPkg(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </VendorLayout>
  );
}
