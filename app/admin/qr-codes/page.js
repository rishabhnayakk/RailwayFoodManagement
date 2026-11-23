/* app/admin/qr-codes/page.js
 * QR Code & Food Package Management Portal
 *
 * Railway administrators register authorized food packages and generate
 * unique cryptographic tokens for printing on passenger meal containers.
 * NO fake records. Real database connections and empty state.
 */

"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonLine } from "@/components/ui/Skeleton";
import { formatDate, generateToken } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import styles from "./qrcodes.module.css";

export default function QrCodesPage() {
  const [packages, setPackages] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    package_name: "",
    vendor_id: "",
    batch_number: "",
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
            qr_token,
            batch_number,
            price,
            created_at,
            vendors (
              business_name
            )
          `)
          .order("created_at", { ascending: false }),
        supabase.from("vendors").select("id, business_name"),
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
    setSubmitting(true);
    const supabase = createClient();
    if (!supabase) {
      alert("Configure Supabase credentials in .env.local first.");
      setSubmitting(false);
      return;
    }

    try {
      const qr_token = generateToken(24); // cryptographically secure 48-char hex
      const { error } = await supabase.from("food_packages").insert([
        {
          package_name: formData.package_name,
          vendor_id: formData.vendor_id || null,
          batch_number: formData.batch_number,
          price: formData.price ? parseFloat(formData.price) : null,
          qr_token: qr_token,
        },
      ]);

      if (error) throw error;

      setFormData({ package_name: "", vendor_id: "", batch_number: "", price: "" });
      setModalOpen(false);
      loadData();
    } catch (err) {
      alert("Error registering package: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminLayout title="QR Code Management">
      <div className={styles.container}>
        {/* Top Controls */}
        <div className={styles.topBar}>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Registered Packages: <strong>{packages.length}</strong>
          </p>
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            + Register Package & Generate QR
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
                description="Food packages and their unique QR tokens will appear here once registered."
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
                      <th>Vendor</th>
                      <th>Batch No.</th>
                      <th>Price</th>
                      <th>QR Token (Truncated)</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packages.map((p) => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>{p.package_name}</td>
                        <td style={{ color: "var(--text-muted)" }}>
                          {p.vendors?.business_name ?? "Unassigned"}
                        </td>
                        <td>{p.batch_number || "—"}</td>
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
                            onClick={() =>
                              alert(
                                `Package Token:\n${p.qr_token}\n\nFeedback URL:\n${window.location.origin}/scan/${p.qr_token}`
                              )
                            }
                          >
                            👁️ View
                          </button>
                        </td>
                      </tr>
                    ))}
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
              <h2 className={styles.modalTitle}>Register Food Package</h2>
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
                  <label>Assign to Vendor</label>
                  <select
                    value={formData.vendor_id}
                    onChange={(e) =>
                      setFormData({ ...formData, vendor_id: e.target.value })
                    }
                  >
                    <option value="">Select Vendor...</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.business_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Batch / Lot Number</label>
                  <input
                    type="text"
                    value={formData.batch_number}
                    onChange={(e) =>
                      setFormData({ ...formData, batch_number: e.target.value })
                    }
                    placeholder="e.g. BATCH-2025-11-A"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Approved Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: e.target.value })
                    }
                    placeholder="e.g. 120.00"
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
      </div>
    </AdminLayout>
  );
}
