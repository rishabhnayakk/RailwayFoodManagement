/* app/inspector/cases/[id]/page.js
 * Quality Inspector Case Investigation File
 */

"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import InspectorLayout from "@/components/layout/InspectorLayout";
import { Card, CardBody } from "@/components/ui/Card";
import { StatusBadge, SeverityBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { SkeletonCard, SkeletonLine } from "@/components/ui/Skeleton";
import { BUCKETS, MAX_IMAGE_BYTES, ALLOWED_MIME } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserProfile } from "@/lib/auth";
import styles from "../../inspector.module.css";

const LIFECYCLE_STAGES = [
  { key: "submitted", label: "1. Submitted" },
  { key: "assigned", label: "2. Assigned" },
  { key: "in_progress", label: "3. In Progress" },
  { key: "report_submitted", label: "4. Report Filed" },
  { key: "resolved", label: "5. Admin Verified" },
];

export default function InspectorCaseDetailPage({ params }) {
  const resolvedParams = use(params);
  const complaintId = resolvedParams?.id;
  const router = useRouter();
  const toast = useToast();

  const [inspector, setInspector] = useState(null);
  const [complaint, setComplaint] = useState(null);
  const [reports, setReports] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  // Inspector Report Form State
  const [investigationDate, setInvestigationDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [problemIdentified, setProblemIdentified] = useState("");
  const [findings, setFindings] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [resolutionDescription, setResolutionDescription] = useState("");
  const [finalOutcome, setFinalOutcome] = useState("resolved"); // 'resolved' | 'unable_to_resolve' | 'escalated'
  const [remarks, setRemarks] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  async function loadCaseData() {
    setLoading(true);
    setUnauthorized(false);

    const authData = await getCurrentUserProfile().catch(() => null);
    if (!authData?.user) {
      router.push("/auth/login");
      return;
    }
    setInspector(authData);

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
            fssai_license,
            train_info,
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

      if (compData.assigned_inspector_id !== authData.user.id) {
        setUnauthorized(true);
        setLoading(false);
        return;
      }

      setComplaint(compData);

      const [repRes, histRes] = await Promise.all([
        supabase
          .from("inspection_reports")
          .select("*")
          .eq("complaint_id", complaintId)
          .order("created_at", { ascending: false }),
        supabase
          .from("complaint_status_history")
          .select("*")
          .eq("complaint_id", complaintId)
          .order("created_at", { ascending: false }),
      ]);

      setReports(repRes.data || []);
      setHistory(histRes.data || []);
    } catch (err) {
      console.error("Error loading case:", err);
      toast.error("Failed to load complaint investigation file.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!complaintId) return;
    const timer = setTimeout(() => {
      loadCaseData();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complaintId]);

  async function handleStartInvestigation() {
    setActionLoading(true);
    const supabase = createClient();
    if (!supabase || !complaint) return;

    try {
      const { error: updateErr } = await supabase
        .from("complaints")
        .update({
          status: "in_progress",
          updated_at: new Date().toISOString(),
        })
        .eq("id", complaint.id);

      if (updateErr) throw updateErr;

      await supabase.from("complaint_status_history").insert([
        {
          complaint_id: complaint.id,
          changed_by: inspector.user.id,
          old_status: complaint.status,
          new_status: "in_progress",
          remarks: `Investigation started by Officer ${inspector.profile?.full_name || "Inspector"}.`,
        },
      ]);

      toast.success("Case acknowledged and moved to In Progress.");
      await loadCaseData();
    } catch (err) {
      toast.error("Failed to update status: " + err.message);
    } finally {
      setActionLoading(false);
    }
  }

  function handleEvidenceSelect(e) {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      if (!ALLOWED_MIME.includes(file.type)) {
        toast.error(`"${file.name}" is not a supported image (JPEG, PNG, WebP).`);
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(`"${file.name}" exceeds the 5 MB file size limit.`);
        return;
      }
    }
    setEvidenceFiles(files);
  }

  async function handleSubmitReport(e) {
    e.preventDefault();
    if (!problemIdentified.trim() || !findings.trim() || !actionTaken.trim() || !resolutionDescription.trim()) {
      toast.error("Please complete Problem Identified, Investigation Findings, Action Taken, and Resolution Description.");
      return;
    }

    setSubmittingReport(true);
    const supabase = createClient();
    if (!supabase || !complaint) {
      setSubmittingReport(false);
      return;
    }

    try {
      const uploadedUrls = [];
      for (const file of evidenceFiles) {
        const ext = file.name.split(".").pop() || "jpg";
        const filePath = `reports/${complaint.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from(BUCKETS.INSPECTION_EVIDENCE)
          .upload(filePath, file);

        if (uploadErr) {
          throw new Error(`Failed to upload evidence "${file.name}": ${uploadErr.message}`);
        }
        const { data: urlData } = supabase.storage
          .from(BUCKETS.INSPECTION_EVIDENCE)
          .getPublicUrl(filePath);
        uploadedUrls.push(urlData.publicUrl);
      }

      // Inspector cannot close a complaint on behalf of Admin:
      // 'resolved' recommendation forwards to Admin verification via 'report_submitted'.
      const nextComplaintStatus =
        finalOutcome === "unable_to_resolve"
          ? "unable_to_resolve"
          : finalOutcome === "escalated"
          ? "escalated"
          : "report_submitted";

      const { error: repErr } = await supabase
        .from("inspection_reports")
        .insert([
          {
            complaint_id: complaint.id,
            inspector_id: inspector.user.id,
            investigation_date: investigationDate || new Date().toISOString().slice(0, 10),
            problem_identified: problemIdentified.trim(),
            findings: findings.trim(),
            action_taken: actionTaken.trim(),
            resolution_description: resolutionDescription.trim(),
            recommended_status: finalOutcome,
            evidence_image_url: uploadedUrls[0] || null,
            evidence_images: uploadedUrls,
            remarks: remarks.trim() || null,
            status: "submitted",
          },
        ]);

      if (repErr) throw repErr;

      const { error: compUpdateErr } = await supabase
        .from("complaints")
        .update({
          status: nextComplaintStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", complaint.id);

      if (compUpdateErr) throw compUpdateErr;

      const statusNote =
        finalOutcome === "unable_to_resolve"
          ? `Inspector marked case Unable to Resolve and submitted report for Admin review.`
          : finalOutcome === "escalated"
          ? `Inspector escalated case to Senior Authority and submitted report.`
          : `Inspector addressed issue and submitted report recommending Resolution. Pending Admin verification.`;

      await supabase.from("complaint_status_history").insert([
        {
          complaint_id: complaint.id,
          changed_by: inspector.user.id,
          old_status: complaint.status,
          new_status: nextComplaintStatus,
          remarks: `${statusNote} (${inspector.profile?.full_name || "Inspector"})`,
        },
      ]);

      toast.success("Inspection report submitted to Railway Administration for verification.");
      setProblemIdentified("");
      setFindings("");
      setActionTaken("");
      setResolutionDescription("");
      setRemarks("");
      setEvidenceFiles([]);
      await loadCaseData();
    } catch (err) {
      toast.error("Error submitting report: " + err.message);
    } finally {
      setSubmittingReport(false);
    }
  }

  const canSubmitNewReport = ["assigned", "in_progress", "reopened"].includes(complaint?.status);
  const currentStageIndex = LIFECYCLE_STAGES.findIndex((s) => s.key === complaint?.status);

  return (
    <InspectorLayout title={`Case File #${complaintId?.slice(0, 8)}`}>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <SkeletonLine height={40} width="60%" />
          <SkeletonCard />
        </div>
      ) : unauthorized ? (
        <Card>
          <CardBody>
            <EmptyState
              icon="🔒"
              title="Access Restricted"
              description="This case file is not assigned to your officer account. Quality inspectors may only view and audit complaints assigned to them."
              action={
                <Link
                  href="/inspector/cases"
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
                  ← Return to My Assigned Cases
                </Link>
              }
            />
          </CardBody>
        </Card>
      ) : !complaint ? (
        <EmptyState
          icon="⚠️"
          title="Case Not Found"
          description="The requested complaint record does not exist."
          action={
            <Link
              href="/inspector/cases"
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
              ← Back to Cases
            </Link>
          }
        />
      ) : (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <Link
              href="/inspector/cases"
              style={{ color: "var(--navy)", textDecoration: "none", fontSize: "0.85rem", fontWeight: 600 }}
            >
              ← Back to Assigned Cases
            </Link>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <SeverityBadge severity={complaint.severity} />
              <StatusBadge status={complaint.status} />
            </div>
          </div>

          <div className={styles.stepper}>
            {LIFECYCLE_STAGES.map((stg, idx) => {
              const isPast = currentStageIndex > idx;
              const isCurrent = currentStageIndex === idx;
              return (
                <div key={stg.key} className={styles.stepItem}>
                  <div
                    className={`${styles.stepDot} ${
                      isPast ? styles.stepDotDone : isCurrent ? styles.stepDotActive : ""
                    }`}
                  >
                    {isPast ? "✓" : idx + 1}
                  </div>
                  <span className={`${styles.stepLabel} ${isCurrent ? styles.stepLabelActive : ""}`}>
                    {stg.label}
                  </span>
                </div>
              );
            })}
          </div>

          {(complaint.status === "assigned" || complaint.status === "reopened") && (
            <div className={styles.actionBanner}>
              <div className={styles.actionBannerText}>
                <div className={styles.actionBannerTitle}>
                  {complaint.status === "reopened"
                    ? "Case Reopened by Administration for Re-Investigation"
                    : "Case Assigned for Quality Audit"}
                </div>
                <div className={styles.actionBannerDesc}>
                  Acknowledge this case to move its status to In Progress while you investigate.
                </div>
              </div>
              <Button variant="primary" onClick={handleStartInvestigation} loading={actionLoading}>
                Acknowledge & Start Investigation →
              </Button>
            </div>
          )}

          <div className={styles.caseGrid}>
            {/* Left Column: Complaint, Passenger Photo, Package/Vendor */}
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div className={styles.caseCard}>
                <h3 className={styles.sectionTitle}>Complaint Overview</h3>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Complaint ID</span>
                  <code style={{ fontFamily: "monospace", fontSize: "0.88rem", fontWeight: 700 }}>
                    {complaint.complaint_ref || complaint.id}
                  </code>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Reported Defect / Issue</span>
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
                  <span className={styles.infoLabel}>Journey & Contact Information</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "4px" }}>
                    <div>Train: <strong>{complaint.train_number || "Unspecified"}</strong></div>
                    <div>PNR: <strong>{complaint.pnr_number || "Unspecified"}</strong></div>
                    <div>Coach/Seat: <strong>{complaint.coach_seat || "Unspecified"}</strong></div>
                    <div>Contact: <strong>{complaint.passenger_contact || "Not provided"}</strong></div>
                  </div>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Passenger Name</span>
                  <span>{complaint.passenger_name || complaint.profiles?.full_name || "Registered Passenger"}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Date Filed</span>
                  <span>{formatDateTime(complaint.created_at)}</span>
                </div>
              </div>

              <div className={styles.caseCard}>
                <h3 className={styles.sectionTitle}>Passenger Photo Evidence</h3>
                {complaint.image_url ? (
                  <img
                    src={complaint.image_url}
                    alt="Food Defect Evidence"
                    className={styles.evidenceImage}
                    onClick={() => window.open(complaint.image_url, "_blank")}
                    style={{ cursor: "pointer" }}
                  />
                ) : (
                  <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontStyle: "italic" }}>
                    No passenger photograph was uploaded with this complaint.
                  </p>
                )}
              </div>

              <div className={styles.caseCard}>
                <h3 className={styles.sectionTitle}>Food Package &amp; Vendor Info</h3>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Package Name</span>
                  <strong>{complaint.food_packages?.package_name || "Unknown Package"}</strong>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Licensed Catering Vendor</span>
                  <strong style={{ color: "var(--navy)" }}>
                    {complaint.food_packages?.vendors?.business_name || "Unassigned"}
                  </strong>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Station Location / Base</span>
                  <span>{complaint.food_packages?.vendors?.station_location || "—"}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>FSSAI / Railway License</span>
                  <span style={{ fontFamily: "monospace" }}>
                    {complaint.food_packages?.fssai_license || complaint.food_packages?.vendors?.license_number || "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Inspector Report Form + Previous Reports + Timeline */}
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {canSubmitNewReport && (
                <div className={styles.caseCard}>
                  <h3 className={styles.sectionTitle}>Submit Inspection / Resolution Report</h3>
                  <form onSubmit={handleSubmitReport}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", padding: "10px", background: "#f8fafc", borderRadius: "8px", border: "1px solid var(--border)", marginBottom: "14px", fontSize: "0.8rem" }}>
                      <div>
                        <span style={{ color: "var(--text-muted)", display: "block" }}>Complaint ID</span>
                        <code style={{ fontFamily: "monospace" }}>{complaint.id.slice(0, 12)}…</code>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-muted)", display: "block" }}>Assigned Inspector</span>
                        <strong>{inspector?.profile?.full_name || "Officer"}</strong>
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Investigation Date *</label>
                      <input
                        type="date"
                        required
                        value={investigationDate}
                        onChange={(e) => setInvestigationDate(e.target.value)}
                        className={styles.fileInput}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Problem Identified *</label>
                      <textarea
                        required
                        rows={2}
                        value={problemIdentified}
                        onChange={(e) => setProblemIdentified(e.target.value)}
                        placeholder="Summarize the root cause identified during inspection..."
                        className={styles.formTextarea}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Investigation Findings *</label>
                      <textarea
                        required
                        rows={3}
                        value={findings}
                        onChange={(e) => setFindings(e.target.value)}
                        placeholder="Detailed pantry/kitchen inspection observations, hygiene readings, sample checks..."
                        className={styles.formTextarea}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Action Taken *</label>
                      <textarea
                        required
                        rows={2}
                        value={actionTaken}
                        onChange={(e) => setActionTaken(e.target.value)}
                        placeholder="Immediate action taken on site (e.g. batch quarantined, vendor warned, kitchen sanitized)..."
                        className={styles.formTextarea}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Resolution Description *</label>
                      <textarea
                        required
                        rows={2}
                        value={resolutionDescription}
                        onChange={(e) => setResolutionDescription(e.target.value)}
                        placeholder="Describe how the issue was addressed or why escalation is needed..."
                        className={styles.formTextarea}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Final Investigation Outcome *</label>
                      <select
                        value={finalOutcome}
                        onChange={(e) => setFinalOutcome(e.target.value)}
                        className={styles.fileInput}
                      >
                        <option value="resolved">Issue Addressed — Recommend Resolved (Admin verifies)</option>
                        <option value="unable_to_resolve">Unable to Resolve</option>
                        <option value="escalated">Escalate to Senior Authority</option>
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Evidence Photographs (Multiple allowed, up to 5 MB each)</label>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleEvidenceSelect}
                        className={styles.fileInput}
                      />
                      {evidenceFiles.length > 0 && (
                        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                          Selected: {evidenceFiles.map((f) => f.name).join(", ")}
                        </p>
                      )}
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Additional Remarks (Optional)</label>
                      <textarea
                        rows={2}
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Any penalty recommendations or follow-up notes for Admin..."
                        className={styles.formTextarea}
                      />
                    </div>

                    <Button type="submit" variant="primary" loading={submittingReport}>
                      Submit Inspection Report →
                    </Button>
                  </form>
                </div>
              )}

              {reports.length > 0 && (
                <div className={styles.caseCard}>
                  <h3 className={styles.sectionTitle}>📄 Submitted Inspection Reports ({reports.length})</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {reports.map((report) => (
                      <div key={report.id} className={styles.reportBox}>
                        <div className={styles.reportHeader}>
                          <span className={styles.reportHeaderTitle}>Inspection Report</span>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            {report.investigation_date ? formatDate(report.investigation_date) : formatDateTime(report.created_at)}
                          </span>
                        </div>
                        {report.problem_identified && (
                          <div>
                            <span className={styles.infoLabel}>Problem Identified</span>
                            <p className={styles.reportText}>{report.problem_identified}</p>
                          </div>
                        )}
                        <div>
                          <span className={styles.infoLabel}>Findings</span>
                          <p className={styles.reportText}>{report.findings}</p>
                        </div>
                        {report.action_taken && (
                          <div>
                            <span className={styles.infoLabel}>Action Taken</span>
                            <p className={styles.reportText}>{report.action_taken}</p>
                          </div>
                        )}
                        {report.resolution_description && (
                          <div>
                            <span className={styles.infoLabel}>Resolution Description</span>
                            <p className={styles.reportText}>{report.resolution_description}</p>
                          </div>
                        )}
                        {report.recommended_status && (
                          <div>
                            <span className={styles.infoLabel}>Recommended Outcome</span>
                            <StatusBadge status={report.recommended_status} />
                          </div>
                        )}
                        {(Array.isArray(report.evidence_images) && report.evidence_images.length > 0
                          ? report.evidence_images
                          : report.evidence_image_url
                          ? [report.evidence_image_url]
                          : []
                        ).map((url, idx) => (
                          <img
                            key={idx}
                            src={url}
                            alt={`Evidence ${idx + 1}`}
                            className={styles.evidenceImage}
                            onClick={() => window.open(url, "_blank")}
                            style={{ cursor: "pointer", marginTop: "6px" }}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className={styles.caseCard}>
                <h3 className={styles.sectionTitle}>Investigation Timeline &amp; Status History</h3>
                {history.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No status transitions logged yet.</p>
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
                            <span className={styles.timelineDate}>{formatDateTime(h.created_at)}</span>
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
        </div>
      )}
    </InspectorLayout>
  );
}
