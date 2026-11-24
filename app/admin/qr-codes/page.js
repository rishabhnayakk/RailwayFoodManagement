/* app/admin/qr-codes/page.js
 * QR Code & Food Package Management Portal
 *
 * Railway administrators register authorized food packages and generate
 * unique cryptographic tokens for printing on passenger meal containers.
 * Generates downloadable QR code images using the `qrcode` library.
 * NO fake records. Real database connections and empty state.
 */

"use client";

import { useState, useEffect } from "react";
import QRCode from "qrcode";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonLine } from "@/components/ui/Skeleton";
import { formatDate, generateToken } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserProfile } from "@/lib/auth";
import styles from "./qrcodes.module.css";

export default function QrCodesPage() {
  const [packages, setPackages] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Active QR View Modal State
  const [activeQrModal, setActiveQrModal] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [generatingQr, setGeneratingQr] = useState(false);

  const [formData, setFormData] = useState({
    package_name: "",
    vendor_id: "",
    category: "Meal",
    description: "",
    price: "",
  });

  async function loadData() {
    setLoading(true);
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const [pkgsRes, vendsRes] = await Promise.all([
        supabase
          .from("food_packages")
          .select(`
            id,
            package_name,
            category,
            price,
            description,
            qr_token,
            status,
            created_at,
            vendors (
              id,
              business_name,
              station_location,
              license_number
            ),
            qr_codes (
              id,
              is_active
            )
          `)
          .order("created_at", { ascending: false }),
        supabase.from("vendors").select("id, business_name, station_location").eq("status", "active"),
      ]);

      if (pkgsRes.data) setPackages(pkgsRes.data);
      if (vendsRes.data) setVendors(vendsRes.data);
    } catch (err) {
      console.error("Error loading packages:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleRegister(e) {
    e.preventDefault();
    if (!formData.vendor_id) {
      alert("Please select an authorized catering vendor.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    if (!supabase) {
      alert("Configure Supabase credentials in .env.local first.");
      setSubmitting(false);
      return;
    }

    try {
      const authData = await getCurrentUserProfile();
      const qr_token = generateToken(24); // cryptographically secure 48-char hex

      // 1. Insert into food_packages
      const { data: pkgData, error: pkgErr } = await supabase
        .from("food_packages")
        .insert([
          {
            package_name: formData.package_name.trim(),
            vendor_id: formData.vendor_id,
            category: formData.category || "Meal",
            description: formData.description.trim() || null,
            price: formData.price ? parseFloat(formData.price) : null,
            qr_token: qr_token,
            status: "active",
          },
        ])
        .select()
        .single();

      if (pkgErr) throw pkgErr;

      // 2. Insert into qr_codes table
      const { error: qrErr } = await supabase.from("qr_codes").insert([
        {
          package_id: pkgData.id,
          qr_token: qr_token,
          is_active: true,
        },
      ]);

      if (qrErr) console.warn("Note: qr_codes table insert fallback:", qrErr.message);

      // 3. Log to audit_logs
      await supabase.from("audit_logs").insert([
        {
          user_id: authData?.user?.id || null,
          action: "REGISTER_FOOD_PACKAGE",
          target_entity: "food_package",
          details: {
            package_id: pkgData.id,
            package_name: pkgData.package_name,
            qr_token: qr_token,
          },
        },
      ]);

      setFormData({ package_name: "", vendor_id: "", category: "Meal", description: "", price: "" });
      setModalOpen(false);
      alert("Food package authorized and QR code token generated.");
      loadData();
    } catch (err) {
      alert("Error registering package: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Open QR Code Generator and Download Modal
  async function handleOpenQr(pkg) {
    setActiveQrModal(pkg);
    setGeneratingQr(true);
    setQrDataUrl("");

    try {
      // Build feedback portal URL
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const scanUrl = `${origin}/scan/${pkg.qr_token}`;

      // Generate Data URL using qrcode package
      const url = await QRCode.toDataURL(scanUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      });

      setQrDataUrl(url);
    } catch (err) {
      console.error("Error generating QR code:", err);
      alert("Failed to render QR Code: " + err.message);
    } finally {
      setGeneratingQr(false);
    }
  }

  // Toggle QR Code Active / Deactivated
  async function handleToggleQrStatus(pkg) {
    const qrRecord = Array.isArray(pkg.qr_codes) ? pkg.qr_codes[0] : pkg.qr_codes;
    const currentActive = qrRecord?.is_active ?? true;
    const newActive = !currentActive;

    const confirmMsg = newActive
      ? `Reactivate QR Code for "${pkg.package_name}"?`
      : `Deactivate and recall QR Code for "${pkg.package_name}"? Passengers scanning this code will be warned that it is revoked.`;

    if (!confirm(confirmMsg)) return;

    const supabase = createClient();
    if (!supabase) return;

    try {
      if (qrRecord?.id) {
        await supabase
          .from("qr_codes")
          .update({ is_active: newActive })
          .eq("id", qrRecord.id);
      } else {
        // Fallback update on food_packages
        await supabase
          .from("food_packages")
          .update({ status: newActive ? "active" : "inactive" })
          .eq("id", pkg.id);
      }

      alert(newActive ? "QR code reactivated." : "QR code revoked and deactivated.");
      loadData();
      if (activeQrModal?.id === pkg.id) {
        setActiveQrModal(null);
      }
    } catch (err) {
      alert("Failed to update QR status: " + err.message);
    }
  }

  return (
    <AdminLayout title="Food Package & QR Code Management">
      <div className={styles.container}>
        {/* Top Controls */}
        <div className={styles.topBar}>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Authorized Food Packages: <strong>{packages.length}</strong>
          </p>
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            + Register Food Package & Generate QR
          </Button>
        </div>

        {/* Packages Table Card */}
        <Card>
          <CardHeader>
            <CardTitle>Authorized Food Packages & QR Tokens</CardTitle>
          </CardHeader>
          <CardBody style={{ padding: 0 }}>
            {loading ? (
              <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
                {[1, 2, 3].map((i) => (
                  <SkeletonLine key={i} height={20} />
                ))}
              </div>
            ) : packages.length === 0 ? (
              <EmptyState
                icon="📱"
                title="No packages registered"
                description="Food packages and their unique verification QR tokens will appear here once registered."
                action={
                  <Button variant="primary" onClick={() => setModalOpen(true)}>
                    + Register First Package
                  </Button>
                }
              />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Package Name</th>
                      <th>Catering Vendor & Station</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>QR Token</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packages.map((p) => {
                      const qrRec = Array.isArray(p.qr_codes) ? p.qr_codes[0] : p.qr_codes;
                      const isActive = qrRec?.is_active ?? (p.status === "active");

                      return (
                        <tr key={p.id}>
                          <td>
                            <strong style={{ display: "block" }}>{p.package_name}</strong>
                            {!isActive && (
                              <span style={{ fontSize: "0.72rem", color: "#dc2626", fontWeight: 700 }}>
                                [RECALLED / DEACTIVATED]
                              </span>
                            )}
                          </td>
                          <td style={{ color: "var(--text-muted)" }}>
                            <div>{p.vendors?.business_name ?? "Unassigned"}</div>
                            {p.vendors?.station_location && (
                              <span style={{ fontSize: "0.75rem" }}>
                                📍 {p.vendors.station_location}
                              </span>
                            )}
                          </td>
                          <td>{p.category || "Meal"}</td>
                          <td>{p.price ? `₹${p.price}` : "—"}</td>
                          <td>
                            <span className={styles.tokenText}>
                              {p.qr_token ? `${p.qr_token.slice(0, 16)}…` : "—"}
                            </span>
                          </td>
                          <td style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                            {formatDate(p.created_at)}
                          </td>
                          <td>
                            <button
                              className={styles.actionBtn}
                              onClick={() => handleOpenQr(p)}
                              style={{ background: "var(--navy)", color: "#fff", borderColor: "var(--navy)" }}
                            >
                              📱 View & Download QR
                            </button>
                            <button
                              className={styles.actionBtn}
                              onClick={() => handleToggleQrStatus(p)}
                              style={{ color: isActive ? "#dc2626" : "#16a34a" }}
                            >
                              {isActive ? "Deactivate" : "Activate"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Register Package Modal */}
        {modalOpen && (
          <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h2 className={styles.modalTitle}>Register Food Package & Generate QR</h2>
              <form onSubmit={handleRegister}>
                <div className={styles.formGroup}>
                  <label>Food Package Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.package_name}
                    onChange={(e) =>
                      setFormData({ ...formData, package_name: e.target.value })
                    }
                    placeholder="e.g. Standard Veg Thali Box"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Authorized Catering Vendor *</label>
                  <select
                    required
                    value={formData.vendor_id}
                    onChange={(e) =>
                      setFormData({ ...formData, vendor_id: e.target.value })
                    }
                  >
                    <option value="">Select Vendor...</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.business_name} ({v.station_location})
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Meal Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                  >
                    <option value="Meal">Full Meal (Thali)</option>
                    <option value="Breakfast">Breakfast / Combo</option>
                    <option value="Snacks">Snacks & Light Refreshment</option>
                    <option value="Beverage">Beverages / Tea / Coffee</option>
                    <option value="Packaged">Packaged Drinking Water</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Approved Tariff / Price (₹)</label>
                  <input
                    type="number"
                    step="0.50"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: e.target.value })
                    }
                    placeholder="e.g. 120.00"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Package Description / Contents</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="e.g. 2 Parathas, Dal Makhani, Paneer Sabzi, Rice, Pickle"
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
                    Generate Token & Save
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Printable QR Sticker Modal */}
        {activeQrModal && (
          <div className={styles.modalOverlay} onClick={() => setActiveQrModal(null)}>
            <div className={styles.modal} style={{ maxWidth: "440px" }} onClick={(e) => e.stopPropagation()}>
              <h2 className={styles.modalTitle}>Official Packaging QR Sticker</h2>

              <div className={styles.qrSticker}>
                <div style={{ fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.05em", color: "var(--navy)" }}>
                  INDIAN RAILWAYS QUALITY MONITORING
                </div>

                <div className={styles.qrTitle}>
                  {activeQrModal.package_name}
                </div>

                <div className={styles.qrSub}>
                  Vendor: <strong>{activeQrModal.vendors?.business_name}</strong>
                  {activeQrModal.vendors?.station_location && ` (${activeQrModal.vendors.station_location})`}
                </div>

                {generatingQr ? (
                  <div style={{ padding: "40px", color: "var(--text-muted)" }}>
                    Generating QR Code...
                  </div>
                ) : qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Food Package Verification QR"
                    className={styles.qrImage}
                  />
                ) : null}

                <div className={styles.qrTokenBox}>
                  TOKEN: {activeQrModal.qr_token}
                </div>

                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Scan with mobile camera to rate quality & report hygiene issues.
                </div>
              </div>

              <div className={styles.qrButtons}>
                {qrDataUrl && (
                  <a
                    href={qrDataUrl}
                    download={`${activeQrModal.package_name.replace(/\s+/g, "_")}_QR.png`}
                    style={{
                      display: "inline-block",
                      padding: "8px 14px",
                      background: "var(--navy)",
                      color: "#fff",
                      borderRadius: "6px",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    💾 Download Printable PNG
                  </a>
                )}

                <a
                  href={`/scan/${activeQrModal.qr_token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-block",
                    padding: "8px 14px",
                    background: "#f1f5f9",
                    color: "var(--navy)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  🔗 Open Passenger Form
                </a>

                <Button
                  variant="ghost"
                  onClick={() => setActiveQrModal(null)}
                >
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
