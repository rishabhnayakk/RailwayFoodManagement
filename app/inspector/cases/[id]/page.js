/* app/inspector/cases/[id]/page.js
 * Quality Inspector Case Investigation File
 *
 * Dedicated investigation workspace for assigned railway quality inspectors.
 * Strictly adheres to role boundaries: inspectors only access cases assigned to them.
 * Provides investigation progress tracking, passenger evidence inspection,
 * on-site audit report generation, and photographic evidence submission.
 */

"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import InspectorLayout from "@/components/layout/InspectorLayout";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { StatusBadge, SeverityBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonCard, SkeletonLine } from "@/components/ui/Skeleton";
import { formatDate, formatDateTime } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserProfile } from "@/lib/auth";
import styles from "../../inspector.module.css";

const LIFECYCLE_STAGES = [
  { key: "submitted", label: "1. Submitted" },
  { key: "pending_review", label: "2. Review" },
  { key: "assigned", label: "3. Assigned" },
  { key: "in_progress", label: "4. In Progress" },
  { key: "report_submitted", label: "5. Report" },
  { key: "resolved", label: "6. Closed" },
];

export default function InspectorCaseDetailPage({ params }) {
  const resolvedParams = use(params);
  const complaintId = resolvedParams?.id;
  const router = useRouter();

  const [inspector, setInspector] = useState(null);
  const [complaint, setComplaint] = useState(null);
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  // Inspector Report Form State
  const [findings, setFindings] = useState("");
  const [remarks, setRemarks] = useState("");
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  async function loadCaseData() {
    setLoading(true);
    setUnauthorized(false);

    const authData = await getCurrentUserProfile();
    if (!authData?.user) {
      router.push("/inspector/login");
      return;
    }
    setInspector(authData);

    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch Complaint Details
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

      // Role check: Inspector must be assigned to this complaint (or admin)
      if (
        compData.assigned_inspector_id !== authData.user.id &&
        authData.profile?.role !== "admin"
      ) {
        setUnauthorized(true);
        setLoading(false);
        return;
      }

      setComplaint(compData);

      // 2. Fetch existing inspection reports if any
      const { data: reportData } = await supabase
        .from("inspection_reports")
        .select("*")
        .eq("complaint_id", complaintId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (reportData) {
        setReport(reportData);
      }

      // 3. Fetch complaint status audit history
      const { data: histData } = await supabase
        .from("complaint_status_history")
        .select("*")
        .eq("complaint_id", complaintId)
        .order("created_at", { ascending: false });

      if (histData) {
        setHistory(histData);
      }
    } catch (err) {
      console.error("Error loading case:", err);
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

  // Transition status from 'assigned' to 'in_progress'
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

      // Add audit history
      await supabase.from("complaint_status_history").insert([
        {
          complaint_id: complaint.id,
          changed_by: inspector.user.id,
          old_status: complaint.status,
          new_status: "in_progress",
          remarks: `Inspection initiated on-site by Officer ${inspector.profile?.full_name || "Inspector"}.`,
        },
      ]);

      await loadCaseData();
    } catch (err) {
      alert("Failed to update status: " + err.message);
    } finally {
      setActionLoading(false);
    }
  }

  // Submit Official Inspection Report
  async function handleSubmitReport(e) {
    e.preventDefault();
    if (!findings.trim()) {
      alert("Please provide detailed inspection findings and observations.");
      return;
    }

    setSubmittingReport(true);
    const supabase = createClient();
    if (!supabase || !complaint) {
      setSubmittingReport(false);
      return;
    }

    try {
      let evidenceImageUrl = null;

      // Upload inspection evidence photo if provided
      if (evidenceFile) {
        const ext = evidenceFile.name.split(".").pop();
        const fileName = `inspection-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const filePath = `reports/${fileName}`;

        const { error: uploadErr } = await supabase.storage
          .from("food-images")
          .upload(filePath, evidenceFile);

        if (!uploadErr) {
          const { data: urlData } = supabase.storage
            .from("food-images")
            .getPublicUrl(filePath);
          evidenceImageUrl = urlData.publicUrl;
        }
      }

      // 1. Insert into inspection_reports table
      const { data: repData, error: repErr } = await supabase
        .from("inspection_reports")
        .insert([
          {
            complaint_id: complaint.id,
            inspector_id: inspector.user.id,
            findings: findings.trim(),
            remarks: remarks.trim() || null,
            evidence_image_url: evidenceImageUrl,
            status: "submitted",
          },
        ])
        .select()
        .single();

      if (repErr) throw repErr;

      // 2. Update complaint status to 'report_submitted'
      const { error: compUpdateErr } = await supabase
        .from("complaints")
        .update({
          status: "report_submitted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", complaint.id);

      if (compUpdateErr) throw compUpdateErr;

      // 3. Insert status history audit record
      await supabase.from("complaint_status_history").insert([
        {
          complaint_id: complaint.id,
          changed_by: inspector.user.id,
          old_status: complaint.status,
          new_status: "report_submitted",
          remarks: `Official quality audit report submitted by Inspector ${inspector.profile?.full_name || ""}. Case forwarded to Railway Authority for final review.`,
        },
      ]);

      alert("Inspection report successfully submitted to the Railway Quality Administration.");
      setFindings("");
      setRemarks("");
      setEvidenceFile(null);
      await loadCaseData();
    } catch (err) {
      alert("Error submitting report: " + err.message);
    } finally {
      setSubmittingReport(false);
    }
  }

  // Calculate current stage index for stepper
  const currentStageIndex = LIFECYCLE_STAGES.findIndex(
    (s) => s.key === complaint?.status
  );

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
              description="This case file is not assigned to your officer account. Quality inspectors may only review and audit cases formally assigned to them by the Railway Quality Authority."
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
          description="The requested complaint record does not exist or has been removed."
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
          {/* Top Back Link & Summary */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <Link
              href="/inspector/cases"
              style={{
                color: "var(--navy)",
                textDecoration: "none",
                fontSize: "0.85rem",
                fontWeight: 600,
              }}
            >
              ← Back to Assigned Cases
            </Link>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <SeverityBadge severity={complaint.severity} />
              <StatusBadge status={complaint.status} />
            </div>
          </div>

          {/* Visual Lifecycle Stepper */}
          <div className={styles.stepper}>
            {LIFECYCLE_STAGES.map((stg, idx) => {
              const isPast = currentStageIndex > idx;
              const isCurrent = currentStageIndex === idx;
              return (
                <div key={stg.key} className={styles.stepItem}>
                  <div
                    className={`${styles.stepDot} ${
                      isPast
                        ? styles.stepDotDone
                        : isCurrent
                        ? styles.stepDotActive
                        : ""
                    }`}
                  >
                    {isPast ? "✓" : idx + 1}
                  </div>
                  <span
                    className={`${styles.stepLabel} ${
                      isCurrent ? styles.stepLabelActive : ""
                    }`}
                  >
                    {stg.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Action Prompt Banner for Inspector */}
          {complaint.status === "assigned" && (
            <div className={styles.actionBanner}>
              <div className={styles.actionBannerText}>
                <div className={styles.actionBannerTitle}>
                  ⚡ Case Newly Assigned for Quality Audit
                </div>
                <div className={styles.actionBannerDesc}>
                  Please acknowledge this assignment and begin the physical or pantry investigation.
                </div>
              </div>
              <Button
                variant="primary"
                onClick={handleStartInvestigation}
                loading={actionLoading}
              >
                Acknowledge & Begin Investigation →
              </Button>
            </div>
          )}

          {complaint.status === "in_progress" && !report && (
            <div className={styles.actionBanner} style={{ background: "#fefce8", borderColor: "#fde047" }}>
              <div className={styles.actionBannerText}>
                <div className={styles.actionBannerTitle} style={{ color: "#854d0e" }}>
                  🔍 Investigation In Progress
                </div>
                <div className={styles.actionBannerDesc} style={{ color: "#a16207" }}>
                  Perform food inspection, record sample findings, and submit your official report below.
                </div>
              </div>
            </div>
          )}

          {/* Main 2-Column Grid */}
          <div className={styles.caseGrid}>
            {/* Left Column: Complaint Details & Passenger Evidence */}
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Card 1: Passenger Complaint */}
              <div className={styles.caseCard}>
                <h3 className={styles.sectionTitle}>📋 Complaint Overview</h3>

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
                  <span className={styles.infoLabel}>Journey & Train Information</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "4px" }}>
                    <div>Train: <strong>{complaint.train_number || "Unspecified"}</strong></div>
                    <div>PNR: <strong>{complaint.pnr_number || "Unspecified"}</strong></div>
                    <div>Coach/Seat: <strong>{complaint.coach_seat || "Unspecified"}</strong></div>
                    <div>Contact: <strong>{complaint.passenger_contact || "Not provided"}</strong></div>
                  </div>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Passenger Profile</span>
                  <span style={{ color: "var(--text)" }}>
                    {complaint.profiles?.full_name || "Registered Passenger"} ({complaint.profiles?.email || "Email on file"})
                  </span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Date Filed</span>
                  <span>{formatDateTime(complaint.created_at)}</span>
                </div>
              </div>

              {/* Card 2: Passenger Photographic Evidence */}
              <div className={styles.caseCard}>
                <h3 className={styles.sectionTitle}>📸 Passenger Photo Evidence</h3>
                {complaint.image_url ? (
                  <div>
                    <img
                      src={complaint.image_url}
                      alt="Food Defect Evidence"
                      className={styles.evidenceImage}
                      onClick={() => window.open(complaint.image_url, "_blank")}
                      style={{ cursor: "pointer" }}
                      title="Click to view full image in new tab"
                    />
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "6px" }}>
                      🔍 Click image to open high-resolution evidence in a new tab.
                    </p>
                  </div>
                ) : (
                  <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontStyle: "italic" }}>
                    No passenger photograph was uploaded with this complaint.
                  </p>
                )}
              </div>

              {/* Card 3: Vendor & Package Context */}
              <div className={styles.caseCard}>
                <h3 className={styles.sectionTitle}>🏪 Food Package & Vendor Info</h3>

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
                    {complaint.food_packages?.vendors?.license_number || "—"}
                  </span>
                </div>

                {complaint.food_packages?.vendors?.phone && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Vendor Phone</span>
                    <span>{complaint.food_packages?.vendors?.phone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Inspection Reporting & Audit Trail */}
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Inspection Report Submission or Display */}
              <div className={styles.caseCard}>
                <h3 className={styles.sectionTitle}>
                  📝 Official Quality Audit Report
                </h3>

                {report ? (
                  <div className={styles.reportBox}>
                    <div className={styles.reportHeader}>
                      <span className={styles.reportHeaderTitle}>
                        ✅ Inspection Report Submitted
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {formatDateTime(report.created_at)}
                      </span>
                    </div>

                    <div>
                      <span className={styles.infoLabel}>Findings & Observations</span>
                      <p className={styles.reportText}>{report.findings}</p>
                    </div>

                    {report.remarks && (
                      <div>
                        <span className={styles.infoLabel}>Recommended Actions / Remarks</span>
                        <p className={styles.reportText}>{report.remarks}</p>
                      </div>
                    )}

                    {report.evidence_image_url && (
                      <div>
                        <span className={styles.infoLabel}>Inspector Evidence Photo</span>
                        <img
                          src={report.evidence_image_url}
                          alt="Inspector Audit Evidence"
                          className={styles.evidenceImage}
                          onClick={() => window.open(report.evidence_image_url, "_blank")}
                          style={{ cursor: "pointer", marginTop: "8px" }}
                        />
                      </div>
                    )}

                    <div style={{ padding: "8px 12px", background: "#e0f2fe", borderRadius: "6px", fontSize: "0.8rem", color: "#0369a1" }}>
                      ℹ️ This report has been submitted to the Railway Quality Administrator for final review and complaint closure.
                    </div>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "16px" }}>
                      Record your official investigation observations, hygiene audit findings, and corrective recommendations. Submitting will advance this complaint to the Railway Quality Authority.
                    </p>

                    <form onSubmit={handleSubmitReport}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>
                          Inspection Findings & Observations *
                        </label>
                        <textarea
                          required
                          value={findings}
                          onChange={(e) => setFindings(e.target.value)}
                          placeholder="e.g. Conducted physical inspection of pantry car at NDLS. Observed packaging seal was broken prior to passenger handover. Temperature recorder indicated 42°C. Batch recalled."
                          className={styles.formTextarea}
                          rows={4}
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>
                          Action Taken / Penalties Recommended
                        </label>
                        <textarea
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          placeholder="e.g. Issued show-cause notice to vendor ABC Catering; ₹5,000 fine recommended under Railway Hygiene Rule 14B."
                          className={styles.formTextarea}
                          rows={3}
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>
                          Upload Inspector Evidence Photo (Optional)
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setEvidenceFile(e.target.files[0] || null)}
                          className={styles.fileInput}
                        />
                      </div>

                      <div style={{ marginTop: "16px" }}>
                        <Button
                          type="submit"
                          variant="primary"
                          loading={submittingReport}
                          disabled={!findings.trim()}
                        >
                          Submit Formal Inspection Report
                        </Button>
                      </div>
                    </form>
                  </div>
                )}
              </div>

              {/* Status History & Audit Trail */}
              <div className={styles.caseCard}>
                <h3 className={styles.sectionTitle}>
                  ⏱️ Investigation Timeline & Status History
                </h3>

                {history.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                    No status transitions logged yet.
                  </p>
                ) : (
                  <div className={styles.timeline}>
                    {history.map((h) => (
                      <div key={h.id} className={styles.timelineItem}>
                        <div className={styles.timelineDot} />
                        <div className={styles.timelineContent}>
                          <div className={styles.timelineTop}>
                            <span className={styles.timelineStatus}>
                              {h.new_status?.replace(/_/g, " ")}
                            </span>
                            <span className={styles.timelineDate}>
                              {formatDateTime(h.created_at)}
                            </span>
                          </div>
                          {h.remarks && (
                            <p className={styles.timelineRemarks}>{h.remarks}</p>
                          )}
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
