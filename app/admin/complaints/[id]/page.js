/* app/admin/complaints/[id]/page.js
 * Administrator Complaint Review & Case Management File
 */

"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/layout/AdminLayout";
import { StatusBadge, SeverityBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { SkeletonCard, SkeletonLine } from "@/components/ui/Skeleton";
import { formatDate, formatDateTime } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserProfile } from "@/lib/auth";
import styles from "../complaints.module.css";

export default function AdminComplaintDetailPage({ params }) {
  const resolvedParams = use(params);
  const complaintId = resolvedParams?.id;
  const router = useRouter();
  const toast = useToast();

  const [adminUser, setAdminUser] = useState(null);
  const [complaint, setComplaint] = useState(null);
  const [inspectors, setInspectors] = useState([]);
  const [selectedInspectorId, setSelectedInspectorId] = useState("");
  const [reports, setReports] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolveRemarks, setResolveRemarks] = useState("");
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [reopenRemarks, setReopenRemarks] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    const authData = await getCurrentUserProfile().catch(() => null);
    if (!authData?.user) {
      router.push("/admin/login");
      return;
    }
    setAdminUser(authData);

    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const { data: compData, error: compErr } = await supabase
        .from("complaints")
        .select(`
          *,
          food_packages (
            id,
            package_name,
            category,
            price,
            vendors (
              id,
              business_name,
              license_number,
              station_location,
              contact_name,
              phone,
              email
            )
          ),
          profiles!complaints_passenger_id_fkey (
            full_name,
            email,
            phone
          )
        `)
        .eq("id", complaintId)
        .single();

      if (compErr || !compData) {
        setComplaint(null);
        setLoading(false);
        return;
      }
      setComplaint(compData);
      setSelectedInspectorId(compData.assigned_inspector_id || "");

      const [inspRes, repRes, histRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, phone, status")
          .eq("role", "inspector")
          .eq("status", "active")
          .order("full_name", { ascending: true }),
        supabase
          .from("inspection_reports")
          .select(`
            *,
            profiles!inspection_reports_inspector_id_fkey (
              full_name,
              email,
              phone
            )
          `)
          .eq("complaint_id", complaintId)
          .order("created_at", { ascending: false }),
        supabase
          .from("complaint_status_history")
          .select("*")
          .eq("complaint_id", complaintId)
          .order("created_at", { ascending: false }),
      ]);

      if (inspRes.data) setInspectors(inspRes.data);
      if (repRes.data) setReports(repRes.data);
      if (histRes.data) setHistory(histRes.data);
    } catch (err) {
      console.error("Error loading complaint details:", err);
      toast.error("Failed to load complaint details.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!complaintId) return;
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complaintId]);

  async function handleAssignInspector() {
    if (!selectedInspectorId) {
      toast.error("Please select a Quality Inspector to assign this case.");
      return;
    }

    setActionLoading(true);
    const supabase = createClient();
    if (!supabase || !complaint) return;

    try {
      const assignedInspector = inspectors.find((i) => i.id === selectedInspectorId);
      const inspectorName = assignedInspector?.full_name || "Quality Inspector";

      const transitionable = ["submitted", "pending_review", "reopened", "unable_to_resolve", "escalated"];
      const newStatus = transitionable.includes(complaint.status) ? "assigned" : complaint.status;
      const now = new Date().toISOString();

      const { error: updateErr } = await supabase
        .from("complaints")
        .update({
          assigned_inspector_id: selectedInspectorId,
          status: newStatus,
          updated_at: now,
        })
        .eq("id", complaint.id);

      if (updateErr) throw updateErr;

      await Promise.all([
        supabase.from("complaint_assignments").insert([
          {
            complaint_id: complaint.id,
            inspector_id: selectedInspectorId,
            assigned_by: adminUser?.user?.id || null,
            remarks: `Assigned to Inspector ${inspectorName}.`,
          },
        ]),
        supabase.from("complaint_status_history").insert([
          {
            complaint_id: complaint.id,
            changed_by: adminUser?.user?.id || null,
            old_status: complaint.status,
            new_status: newStatus,
            remarks: `Assigned to Quality Inspector ${inspectorName} by Railway Administration.`,
          },
        ]),
        supabase.from("audit_logs").insert([
          {
            user_id: adminUser?.user?.id || null,
            action: "ASSIGN_INSPECTOR",
            target_entity: "complaint",
            details: {
              complaint_id: complaint.id,
              inspector_id: selectedInspectorId,
              inspector_name: inspectorName,
            },
          },
        ]),
      ]);

      toast.success(`Case successfully assigned to Officer ${inspectorName}.`);
      await loadData();
    } catch (err) {
      toast.error("Error assigning inspector: " + err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResolveComplaint(e) {
    e.preventDefault();
    setActionLoading(true);
    const supabase = createClient();
    if (!supabase || !complaint) return;

    try {
      const remarksText =
        resolveRemarks.trim() || "Case reviewed and resolved by Railway Quality Administration.";

      const { error: updateErr } = await supabase
        .from("complaints")
        .update({
          status: "resolved",
          updated_at: new Date().toISOString(),
        })
        .eq("id", complaint.id);

      if (updateErr) throw updateErr;

      await Promise.all([
        supabase.from("complaint_status_history").insert([
          {
            complaint_id: complaint.id,
            changed_by: adminUser?.user?.id || null,
            old_status: complaint.status,
            new_status: "resolved",
            remarks: `Verified & Resolved by Admin: ${remarksText}`,
          },
        ]),
        supabase.from("audit_logs").insert([
          {
            user_id: adminUser?.user?.id || null,
            action: "RESOLVE_COMPLAINT",
            target_entity: "complaint",
            details: {
              complaint_id: complaint.id,
              resolution_remarks: remarksText,
            },
          },
        ]),
      ]);

      setResolveModalOpen(false);
      setResolveRemarks("");
      toast.success("Complaint verified and marked as Resolved.");
      await loadData();
    } catch (err) {
      toast.error("Failed to resolve complaint: " + err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReopenComplaint(e) {
    e.preventDefault();
    setActionLoading(true);
    const supabase = createClient();
    if (!supabase || !complaint) return;

    try {
      const remarksText =
        reopenRemarks.trim() || "Complaint reopened for further investigation.";

      const { error: updateErr } = await supabase
        .from("complaints")
        .update({
          status: "reopened",
          updated_at: new Date().toISOString(),
        })
        .eq("id", complaint.id);

      if (updateErr) throw updateErr;

      await Promise.all([
        supabase.from("complaint_status_history").insert([
          {
            complaint_id: complaint.id,
            changed_by: adminUser?.user?.id || null,
            old_status: complaint.status,
            new_status: "reopened",
            remarks: `Reopened by Admin: ${remarksText}`,
          },
        ]),
        supabase.from("audit_logs").insert([
          {
            user_id: adminUser?.user?.id || null,
            action: "REOPEN_COMPLAINT",
            target_entity: "complaint",
            details: {
              complaint_id: complaint.id,
              reopen_remarks: remarksText,
            },
          },
        ]),
      ]);

      setReopenModalOpen(false);
      setReopenRemarks("");
      toast.warning("Complaint reopened for re-audit.");
      await loadData();
    } catch (err) {
      toast.error("Failed to reopen complaint: " + err.message);
    } finally {
      setActionLoading(false);
    }
  }

  const assignedInspectorName = inspectors.find(
    (i) => i.id === complaint?.assigned_inspector_id
  )?.full_name;

  return (
    <AdminLayout title={`Case File #${complaintId?.slice(0, 8)}`}>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <SkeletonLine height={40} width="60%" />
          <SkeletonCard />
        </div>
      ) : !complaint ? (
        <EmptyState
          icon="⚠️"
          title="Complaint Record Not Found"
          description="The requested complaint could not be located in the database."
          action={
            <Link
              href="/admin/complaints"
              style={{
                display: "inline-block",
                padding: "8px 16px",
                background: "var(--navy)",
                color: "#fff",
                borderRadius: "6px",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              ← Back to All Complaints
            </Link>
          }
        />
      ) : (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
            <Link
              href="/admin/complaints"
              style={{ color: "var(--navy)", textDecoration: "none", fontSize: "0.85rem", fontWeight: 600 }}
            >
              ← Back to Complaints List
            </Link>

            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <SeverityBadge severity={complaint.severity} />
              <StatusBadge status={complaint.status} />

              {complaint.status !== "resolved" && (
                <Button
                  variant="primary"
                  onClick={() => setResolveModalOpen(true)}
                  style={{ background: "#16a34a", borderColor: "#16a34a" }}
                >
                  ✓ Confirm Resolved
                </Button>
              )}

              {complaint.status !== "reopened" && (
                <Button
                  variant="outline"
                  onClick={() => setReopenModalOpen(true)}
                  style={{ color: "#d97706", borderColor: "#d97706" }}
                >
                  ↺ Reopen Complaint
                </Button>
              )}
            </div>
          </div>

          <div className={styles.detailGrid}>
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div className={styles.detailCard}>
                <h3 className={styles.sectionTitle}>Complaint Overview</h3>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Defect / Hygiene Issue</span>
                  <strong style={{ fontSize: "1rem", color: "#dc2626" }}>
                    {complaint.issue_type?.replace(/_/g, " ").toUpperCase()}
                  </strong>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Passenger Description</span>
                  <p style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)", margin: "4px 0", lineHeight: 1.5 }}>
                    {complaint.description}
                  </p>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Journey & Contact Details</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "4px" }}>
                    <div>Train: <strong>{complaint.train_number || "Unspecified"}</strong></div>
                    <div>PNR: <strong>{complaint.pnr_number || "Unspecified"}</strong></div>
                    <div>Coach/Seat: <strong>{complaint.coach_seat || "Unspecified"}</strong></div>
                    <div>Contact: <strong>{complaint.passenger_contact || "Not provided"}</strong></div>
                  </div>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Passenger Reporter</span>
                  <span>
                    {complaint.passenger_name || complaint.profiles?.full_name || "Anonymous Passenger"}
                    {complaint.profiles?.email ? ` (${complaint.profiles.email})` : ""}
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Submission Timestamp</span>
                  <span>{formatDateTime(complaint.created_at)}</span>
                </div>
              </div>

              <div className={styles.detailCard}>
                <h3 className={styles.sectionTitle}>Passenger Photo Evidence</h3>
                {complaint.image_url ? (
                  <div>
                    <img
                      src={complaint.image_url}
                      alt="Food Defect Evidence"
                      className={styles.evidenceImage}
                      onClick={() => window.open(complaint.image_url, "_blank")}
                      style={{ cursor: "pointer" }}
                    />
                  </div>
                ) : (
                  <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontStyle: "italic" }}>
                    No passenger photograph was uploaded with this complaint.
                  </p>
                )}
              </div>

              <div className={styles.detailCard}>
                <h3 className={styles.sectionTitle}>Food Package &amp; Licensed Vendor</h3>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Package Name</span>
                  <strong>{complaint.food_packages?.package_name || "Unknown Package"}</strong>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Catering Contractor / Vendor</span>
                  <strong style={{ color: "var(--navy)" }}>
                    {complaint.food_packages?.vendors?.business_name || "Unassigned Vendor"}
                  </strong>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Station Location / Base</span>
                  <span>{complaint.food_packages?.vendors?.station_location || "—"}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>FSSAI / Railway License Number</span>
                  <span style={{ fontFamily: "monospace" }}>
                    {complaint.food_packages?.vendors?.license_number || "—"}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div className={styles.detailCard}>
                <h3 className={styles.sectionTitle}>Quality Inspector Assignment</h3>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Current Assigned Officer</span>
                  {assignedInspectorName ? (
                    <strong>{assignedInspectorName}</strong>
                  ) : (
                    <span style={{ color: "#b45309", fontWeight: 600 }}>Not assigned</span>
                  )}
                </div>

                <div className={styles.assignBox}>
                  <label className={styles.infoLabel}>
                    {assignedInspectorName ? "Reassign to Active Inspector" : "Assign to Active Inspector"}
                  </label>
                  <select
                    value={selectedInspectorId}
                    onChange={(e) => setSelectedInspectorId(e.target.value)}
                    className={styles.assignSelect}
                  >
                    <option value="">Select Quality Inspector...</option>
                    {inspectors.map((ins) => (
                      <option key={ins.id} value={ins.id}>
                        {ins.full_name} ({ins.email})
                      </option>
                    ))}
                  </select>

                  <Button
                    variant="primary"
                    onClick={handleAssignInspector}
                    loading={actionLoading}
                    disabled={!selectedInspectorId || selectedInspectorId === complaint.assigned_inspector_id}
                  >
                    {complaint.assigned_inspector_id ? "Update Assignment" : "Assign Case →"}
                  </Button>
                </div>
              </div>

              <div className={styles.detailCard}>
                <h3 className={styles.sectionTitle}>Official Inspection Reports ({reports.length})</h3>
                {reports.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {reports.map((report) => (
                      <div key={report.id} className={styles.reportBox}>
                        <div className={styles.reportHeader}>
                          <span className={styles.reportTitle}>
                            Report by {report.profiles?.full_name || "Quality Officer"}
                          </span>
                          <span style={{ fontSize: "0.75rem", color: "#166534" }}>
                            {report.investigation_date ? formatDate(report.investigation_date) : formatDateTime(report.created_at)}
                          </span>
                        </div>

                        {report.problem_identified && (
                          <div className={styles.infoRow}>
                            <span className={styles.infoLabel}>Problem Identified</span>
                            <p className={styles.reportFindings}>{report.problem_identified}</p>
                          </div>
                        )}

                        <div className={styles.infoRow}>
                          <span className={styles.infoLabel}>Investigation Findings</span>
                          <p className={styles.reportFindings}>{report.findings}</p>
                        </div>

                        {report.action_taken && (
                          <div className={styles.infoRow}>
                            <span className={styles.infoLabel}>Action Taken</span>
                            <p className={styles.reportFindings}>{report.action_taken}</p>
                          </div>
                        )}

                        {report.resolution_description && (
                          <div className={styles.infoRow}>
                            <span className={styles.infoLabel}>Resolution Description</span>
                            <p className={styles.reportFindings}>{report.resolution_description}</p>
                          </div>
                        )}

                        {report.recommended_status && (
                          <div className={styles.infoRow}>
                            <span className={styles.infoLabel}>Inspector Recommended Outcome</span>
                            <StatusBadge status={report.recommended_status} />
                          </div>
                        )}

                        {report.remarks && (
                          <div className={styles.infoRow}>
                            <span className={styles.infoLabel}>Additional Remarks</span>
                            <p className={styles.reportFindings}>{report.remarks}</p>
                          </div>
                        )}

                        {(Array.isArray(report.evidence_images) && report.evidence_images.length > 0
                          ? report.evidence_images
                          : report.evidence_image_url
                          ? [report.evidence_image_url]
                          : []
                        ).map((url, idx) => (
                          <div key={idx} className={styles.infoRow}>
                            <span className={styles.infoLabel}>Evidence Photo {idx + 1}</span>
                            <img
                              src={url}
                              alt={`Inspector Evidence ${idx + 1}`}
                              className={styles.evidenceImage}
                              onClick={() => window.open(url, "_blank")}
                              style={{ cursor: "pointer", marginTop: "6px" }}
                            />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontStyle: "italic" }}>
                    No inspection report has been submitted by the assigned inspector yet.
                  </p>
                )}
              </div>

              <div className={styles.detailCard}>
                <h3 className={styles.sectionTitle}>Status Audit Trail</h3>
                {history.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                    No timeline records logged yet.
                  </p>
                ) : (
                  <div className={styles.timeline}>
                    {history.map((h) => (
                      <div key={h.id} className={styles.timelineItem}>
                        <div className={styles.timelineDot} />
                        <div className={styles.timelineContent}>
                          <div className={styles.timelineTop}>
                            <span className={styles.timelineStatus}>
                              {h.old_status ? `${h.old_status.replace(/_/g, " ")} → ` : ""}
                              {h.new_status?.replace(/_/g, " ")}
                            </span>
                            <span className={styles.timelineDate}>
                              {formatDateTime(h.created_at)}
                            </span>
                          </div>
                          {h.remarks && <p className={styles.timelineRemarks}>{h.remarks}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {resolveModalOpen && (
            <div className={styles.modalOverlay} onClick={() => setResolveModalOpen(false)}>
              <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <h3 className={styles.modalTitle}>Verify & Resolve Complaint</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  Confirm that the inspector&apos;s investigation and corrective action resolved the reported issue.
                </p>
                <form onSubmit={handleResolveComplaint}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                      Administrative Verification & Closure Remarks *
                    </label>
                    <textarea
                      required
                      value={resolveRemarks}
                      onChange={(e) => setResolveRemarks(e.target.value)}
                      placeholder="e.g. Inspector findings verified. Vendor penalized and pantry sanitized."
                      className={styles.modalTextarea}
                    />
                  </div>
                  <div className={styles.modalActions}>
                    <Button variant="ghost" onClick={() => setResolveModalOpen(false)} disabled={actionLoading}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      loading={actionLoading}
                      style={{ background: "#16a34a", borderColor: "#16a34a" }}
                    >
                      Confirm Resolution
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {reopenModalOpen && (
            <div className={styles.modalOverlay} onClick={() => setReopenModalOpen(false)}>
              <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <h3 className={styles.modalTitle}>Reopen Quality Complaint</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  Reopen this complaint if the issue was not satisfactorily resolved or needs further inspection.
                </p>
                <form onSubmit={handleReopenComplaint}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                      Reason for Reopening *
                    </label>
                    <textarea
                      required
                      value={reopenRemarks}
                      onChange={(e) => setReopenRemarks(e.target.value)}
                      placeholder="e.g. Issue not adequately addressed; re-inspection ordered."
                      className={styles.modalTextarea}
                    />
                  </div>
                  <div className={styles.modalActions}>
                    <Button variant="ghost" onClick={() => setReopenModalOpen(false)} disabled={actionLoading}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      loading={actionLoading}
                      style={{ background: "#d97706", borderColor: "#d97706" }}
                    >
                      Reopen Complaint
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
