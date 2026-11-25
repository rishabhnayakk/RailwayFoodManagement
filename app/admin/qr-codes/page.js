/* app/admin/qr-codes/page.js
 * Admin Food Package Approval & QR Compliance Monitoring
 *
 * IMPORTANT ROLE BOUNDARY:
 * - Admin does NOT upload food packages and does NOT generate vendor QR codes.
 * - Vendors upload food packages and generate QR codes in /vendor/packages.
 * - Admin reviews, approves, or rejects vendor-uploaded packages and can revoke
 *   or reactivate QR codes for safety compliance.
 */

"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { ApprovalBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { SkeletonLine } from "@/components/ui/Skeleton";
import { formatDate, formatDateTime } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserProfile } from "@/lib/auth";
import styles from "./qrcodes.module.css";

export default function AdminPackageApprovalsPage() {
  const toast = useToast();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approvalFilter, setApprovalFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [inspectModalPkg, setInspectModalPkg] = useState(null);
  const [rejectModalPkg, setRejectModalPkg] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [confirmQrPkg, setConfirmQrPkg] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("food_packages")
        .select(`
          *,
          vendors (
            id,
            business_name,
            station_location,
            license_number,
            status
          ),
          qr_codes (
            id,
            qr_token,
            is_active
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const normalized = (data || []).map((pkg) => {
        const qrRecord = Array.isArray(pkg.qr_codes) ? pkg.qr_codes[0] : pkg.qr_codes;
        return {
          ...pkg,
          approval_status: pkg.approval_status || "pending",
          qr_token: qrRecord?.qr_token || "",
          qr_record: qrRecord || null,
        };
      });
      setPackages(normalized);
    } catch (err) {
      console.error("Error loading packages:", err);
      toast.error("Failed to load vendor packages.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleApprovePackage(pkg) {
    setActionLoading(true);
    const supabase = createClient();
    if (!supabase) return;

    try {
      const authData = await getCurrentUserProfile();
      const now = new Date().toISOString();

      const { error } = await supabase
        .from("food_packages")
        .update({
          approval_status: "approved",
          approved_by: authData?.user?.id || null,
          approved_at: now,
          rejection_reason: null,
          updated_at: now,
        })
        .eq("id", pkg.id);

      if (error) throw error;

      await supabase.from("audit_logs").insert([
        {
          user_id: authData?.user?.id || null,
          action: "APPROVE_FOOD_PACKAGE",
          target_entity: "food_package",
          details: { package_id: pkg.id, package_name: pkg.package_name, vendor_id: pkg.vendor_id },
        },
      ]);

      toast.success(`"${pkg.package_name}" approved! Its QR code is now publicly scannable.`);
      setInspectModalPkg(null);
      loadData();
    } catch (err) {
      toast.error("Failed to approve package: " + err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRejectPackage(e) {
    e.preventDefault();
    if (!rejectModalPkg) return;
    setActionLoading(true);
    const supabase = createClient();
    if (!supabase) return;

    try {
      const authData = await getCurrentUserProfile();
      const now = new Date().toISOString();

      const { error } = await supabase
        .from("food_packages")
        .update({
          approval_status: "rejected",
          approved_by: authData?.user?.id || null,
          approved_at: now,
          rejection_reason: rejectionReason.trim() || "Did not meet Railway quality verification standards.",
          updated_at: now,
        })
        .eq("id", rejectModalPkg.id);

      if (error) throw error;

      await supabase.from("audit_logs").insert([
        {
          user_id: authData?.user?.id || null,
          action: "REJECT_FOOD_PACKAGE",
          target_entity: "food_package",
          details: {
            package_id: rejectModalPkg.id,
            package_name: rejectModalPkg.package_name,
            reason: rejectionReason.trim(),
          },
        },
      ]);

      toast.warning(`"${rejectModalPkg.package_name}" rejected. Public QR scanning remains blocked.`);
      setRejectModalPkg(null);
      setRejectionReason("");
      setInspectModalPkg(null);
      loadData();
    } catch (err) {
      toast.error("Failed to reject package: " + err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConfirmToggleQr() {
    if (!confirmQrPkg?.qr_record?.id) return;
    const newActive = !confirmQrPkg.qr_record.is_active;
    setActionLoading(true);
    const supabase = createClient();

    try {
      const authData = await getCurrentUserProfile();
      const { error } = await supabase
        .from("qr_codes")
        .update({ is_active: newActive })
        .eq("id", confirmQrPkg.qr_record.id);

      if (error) throw error;

      await supabase.from("audit_logs").insert([
        {
          user_id: authData?.user?.id || null,
          action: newActive ? "ACTIVATE_QR_CODE" : "REVOKE_QR_CODE",
          target_entity: "qr_code",
          details: { package_id: confirmQrPkg.id, package_name: confirmQrPkg.package_name },
        },
      ]);

      toast.success(newActive ? "QR code reactivated." : "QR code revoked and blocked.");
      setConfirmQrPkg(null);
      loadData();
    } catch (err) {
      toast.error("Failed to update QR status: " + err.message);
    } finally {
      setActionLoading(false);
    }
  }

  const filtered = packages.filter((p) => {
    const matchesApproval = approvalFilter === "all" || p.approval_status === approvalFilter;
    const term = search.toLowerCase();
    const matchesSearch =
      !term ||
      p.package_name?.toLowerCase().includes(term) ||
      p.vendors?.business_name?.toLowerCase().includes(term) ||
      p.train_info?.toLowerCase().includes(term);
    return matchesApproval && matchesSearch;
  });

  return (
    <AdminLayout title="Food Package Approvals & QR Monitoring">
      <div className={styles.container}>
        <div style={{ padding: "10px 14px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "6px", fontSize: "0.84rem", color: "#1e3a8a" }}>
          <strong>Workflow:</strong> Catering Vendors upload food packages and generate QR codes in the Vendor Portal.
          Admin reviews and approves packages here before their QR codes become publicly scannable.
        </div>

        <div className={styles.topBar}>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", flex: 1 }}>
            <input
              type="text"
              placeholder="Search by food name, vendor, or train..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: "1 1 240px",
                padding: "9px 12px",
                border: "1.5px solid var(--border)",
                borderRadius: "8px",
                fontSize: "0.875rem",
              }}
            />
            <select
              value={approvalFilter}
              onChange={(e) => setApprovalFilter(e.target.value)}
              style={{
                padding: "9px 12px",
                border: "1.5px solid var(--border)",
                borderRadius: "8px",
                background: "var(--surface)",
                fontSize: "0.875rem",
              }}
            >
              <option value="all">All Packages ({packages.length})</option>
              <option value="pending">Pending Approval ({packages.filter((p) => p.approval_status === "pending").length})</option>
              <option value="approved">Approved ({packages.filter((p) => p.approval_status === "approved").length})</option>
              <option value="rejected">Rejected ({packages.filter((p) => p.approval_status === "rejected").length})</option>
            </select>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Vendor-Uploaded Packages & QR Verification Status ({filtered.length})</CardTitle>
          </CardHeader>
          <CardBody style={{ padding: 0 }}>
            {loading ? (
              <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
                {[1, 2, 3].map((i) => <SkeletonLine key={i} height={20} />)}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon="📦"
                title="No packages found"
                description="Food packages uploaded by registered Vendors will appear here for approval."
              />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Food Package</th>
                      <th>Catering Vendor</th>
                      <th>Category & Price</th>
                      <th>Approval Status</th>
                      <th>QR Status</th>
                      <th>Uploaded</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => {
                      const qrActive = p.qr_record?.is_active ?? false;
                      const vendorSuspended = p.vendors?.status === "suspended";

                      return (
                        <tr key={p.id}>
                          <td>
                            <strong style={{ display: "block" }}>{p.package_name}</strong>
                            {p.train_info && (
                              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                Train: {p.train_info}
                              </span>
                            )}
                          </td>
                          <td style={{ color: "var(--text-muted)" }}>
                            <div>{p.vendors?.business_name ?? "—"}</div>
                            {vendorSuspended && (
                              <span style={{ fontSize: "0.72rem", color: "#dc2626", fontWeight: 700 }}>
                                [VENDOR SUSPENDED]
                              </span>
                            )}
                          </td>
                          <td>
                            {p.category || "Meals"} · {p.price != null ? `₹${p.price}` : "—"}
                          </td>
                          <td>
                            <ApprovalBadge status={p.approval_status} />
                          </td>
                          <td>
                            {!p.qr_token ? (
                              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>No QR yet</span>
                            ) : qrActive ? (
                              <span style={{ fontSize: "0.78rem", color: "#166534", fontWeight: 600 }}>Active Token</span>
                            ) : (
                              <span style={{ fontSize: "0.78rem", color: "#dc2626", fontWeight: 600 }}>Revoked</span>
                            )}
                          </td>
                          <td style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                            {formatDate(p.created_at)}
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                              <button
                                className={styles.actionBtn}
                                onClick={() => setInspectModalPkg(p)}
                              >
                                Inspect Details
                              </button>
                              {p.approval_status !== "approved" && (
                                <button
                                  className={styles.actionBtn}
                                  style={{ background: "#16a34a", color: "#fff", borderColor: "#16a34a" }}
                                  onClick={() => handleApprovePackage(p)}
                                  disabled={actionLoading}
                                >
                                  Approve
                                </button>
                              )}
                              {p.approval_status !== "rejected" && (
                                <button
                                  className={styles.actionBtn}
                                  style={{ color: "#dc2626" }}
                                  onClick={() => {
                                    setRejectModalPkg(p);
                                    setRejectionReason("");
                                  }}
                                >
                                  Reject
                                </button>
                              )}
                              {p.qr_record && (
                                <button
                                  className={styles.actionBtn}
                                  style={{ color: qrActive ? "#b45309" : "#166534" }}
                                  onClick={() => setConfirmQrPkg(p)}
                                >
                                  {qrActive ? "Revoke QR" : "Enable QR"}
                                </button>
                              )}
                            </div>
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

        {/* Inspect Package Modal */}
        {inspectModalPkg && (
          <div className={styles.modalOverlay} onClick={() => setInspectModalPkg(null)}>
            <div className={styles.modal} style={{ maxWidth: "560px" }} onClick={(e) => e.stopPropagation()}>
              <h2 className={styles.modalTitle}>{inspectModalPkg.package_name}</h2>
              {inspectModalPkg.image_url && (
                <img
                  src={inspectModalPkg.image_url}
                  alt={inspectModalPkg.package_name}
                  style={{ width: "100%", maxHeight: "220px", objectFit: "cover", borderRadius: "8px", marginBottom: "14px", border: "1px solid var(--border)" }}
                />
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.86rem", marginBottom: "16px" }}>
                <div><strong>Vendor:</strong> {inspectModalPkg.vendors?.business_name} ({inspectModalPkg.vendors?.station_location})</div>
                <div><strong>FSSAI License:</strong> {inspectModalPkg.fssai_license || inspectModalPkg.vendors?.license_number || "—"}</div>
                <div><strong>Category & Price:</strong> {inspectModalPkg.category} · {inspectModalPkg.price != null ? `₹${inspectModalPkg.price}` : "—"}</div>
                {inspectModalPkg.train_info && <div><strong>Train:</strong> {inspectModalPkg.train_info}</div>}
                {inspectModalPkg.description && <div><strong>Description:</strong> {inspectModalPkg.description}</div>}
                {inspectModalPkg.ingredients && <div><strong>Ingredients:</strong> {inspectModalPkg.ingredients}</div>}
                {inspectModalPkg.prepared_at && <div><strong>Prepared At:</strong> {formatDateTime(inspectModalPkg.prepared_at)}</div>}
                {inspectModalPkg.expires_at && <div><strong>Expiry At:</strong> {formatDateTime(inspectModalPkg.expires_at)}</div>}
                <div><strong>Approval Status:</strong> <ApprovalBadge status={inspectModalPkg.approval_status} /></div>
                {inspectModalPkg.rejection_reason && (
                  <div style={{ color: "#dc2626" }}><strong>Rejection Reason:</strong> {inspectModalPkg.rejection_reason}</div>
                )}
              </div>

              <div className={styles.modalActions}>
                <Button variant="ghost" onClick={() => setInspectModalPkg(null)}>Close</Button>
                {inspectModalPkg.approval_status !== "rejected" && (
                  <Button
                    variant="danger"
                    onClick={() => {
                      setRejectModalPkg(inspectModalPkg);
                      setRejectionReason("");
                    }}
                  >
                    Reject
                  </Button>
                )}
                {inspectModalPkg.approval_status !== "approved" && (
                  <Button
                    variant="primary"
                    loading={actionLoading}
                    onClick={() => handleApprovePackage(inspectModalPkg)}
                  >
                    Approve for Public Scanning
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Reject Package Modal */}
        {rejectModalPkg && (
          <div className={styles.modalOverlay} onClick={() => setRejectModalPkg(null)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h2 className={styles.modalTitle}>Reject Food Package</h2>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "12px" }}>
                Rejecting <strong>{rejectModalPkg.package_name}</strong> prevents its QR code from being scanned by passengers.
              </p>
              <form onSubmit={handleRejectPackage}>
                <div className={styles.formGroup}>
                  <label>Rejection Reason *</label>
                  <textarea
                    required
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. Missing FSSAI compliance details or incomplete ingredient list."
                    style={{ width: "100%", padding: "10px", border: "1.5px solid var(--border)", borderRadius: "6px" }}
                  />
                </div>
                <div className={styles.modalActions}>
                  <Button variant="ghost" onClick={() => setRejectModalPkg(null)} disabled={actionLoading}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="danger" loading={actionLoading}>
                    Confirm Rejection
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={Boolean(confirmQrPkg)}
          title={confirmQrPkg?.qr_record?.is_active ? "Revoke QR Code?" : "Reactivate QR Code?"}
          message={
            confirmQrPkg?.qr_record?.is_active
              ? `Revoking the QR code for "${confirmQrPkg?.package_name}" will block passenger scanning immediately.`
              : `Reactivating the QR code for "${confirmQrPkg?.package_name}" will allow scanning if the package and vendor are active.`
          }
          confirmLabel={confirmQrPkg?.qr_record?.is_active ? "Revoke QR" : "Enable QR"}
          variant={confirmQrPkg?.qr_record?.is_active ? "danger" : "primary"}
          loading={actionLoading}
          onConfirm={handleConfirmToggleQr}
          onCancel={() => setConfirmQrPkg(null)}
        />
      </div>
    </AdminLayout>
  );
}
