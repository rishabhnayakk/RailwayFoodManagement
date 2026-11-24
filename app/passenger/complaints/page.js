/* app/passenger/complaints/page.js
 * Passenger Complaints History & Visual Lifecycle Tracker
 * Displays the 6-stage investigation progress for every complaint submitted by the passenger.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import PassengerLayout from "@/components/layout/PassengerLayout";
import { StatusBadge, SeverityBadge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { formatDate, formatDateTime } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserProfile } from "@/lib/auth";
import styles from "../passenger.module.css";

const STAGES = [
  { key: "submitted", label: "Submitted" },
  { key: "pending_review", label: "Review" },
  { key: "assigned", label: "Assigned" },
  { key: "in_progress", label: "Investigating" },
  { key: "report_submitted", label: "Report Filed" },
  { key: "resolved", label: "Resolved" },
];

function getStageIndex(status) {
  const map = {
    submitted: 0,
    pending: 1,
    pending_review: 1,
    under_review: 1,
    assigned: 2,
    in_progress: 3,
    report_submitted: 4,
    resolved: 5,
    reopened: 1,
  };
  return map[status] ?? 0;
}

export default function PassengerComplaintsPage() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    async function loadComplaints() {
      setLoading(true);
      const authData = await getCurrentUserProfile();
      if (!authData?.user) {
        setLoading(false);
        return;
      }

      const supabase = createClient();
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("complaints")
          .select(`
            *,
            food_packages (
              package_name,
              price,
              vendors (
                business_name,
                station_location
              )
            ),
            inspection_reports (
              id,
              findings,
              remarks,
              created_at
            ),
            complaint_status_history (
              id,
              old_status,
              new_status,
              remarks,
              created_at
            )
          `)
          .eq("passenger_id", authData.user.id)
          .order("created_at", { ascending: false });

        if (!error && data) {
          setComplaints(data);
        }
      } catch (err) {
        console.error("Error loading complaints:", err);
      } finally {
        setLoading(false);
      }
    }

    loadComplaints();
  }, []);

  return (
    <PassengerLayout>
      <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--text)" }}>
            My Quality Complaints & Investigation Status
          </h1>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Real-time tracking of food defect reports submitted through RailGuard
          </p>
        </div>
        <Link
          href="/scan"
          style={{
            background: "var(--navy)",
            color: "#fff",
            padding: "9px 16px",
            borderRadius: "8px",
            fontSize: "0.85rem",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          + File New Complaint
        </Link>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : complaints.length === 0 ? (
        <EmptyState
          icon="⚠️"
          title="No complaints filed yet"
          description="You have not submitted any food quality or hygiene complaints. All complaints filed after scanning QR codes will display here."
          action={
            <Link
              href="/scan"
              style={{
                background: "var(--navy)",
                color: "#fff",
                padding: "10px 18px",
                borderRadius: "8px",
                fontSize: "0.875rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Scan Food Package QR
            </Link>
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {complaints.map((c) => {
            const currentStageIdx = getStageIndex(c.status);
            const isExpanded = expandedId === c.id;

            return (
              <div key={c.id} className={styles.complaintItem}>
                {/* Header Row */}
                <div className={styles.complaintHead}>
                  <div>
                    <h2 className={styles.pkgName}>
                      {c.food_packages?.package_name || "Food Package"}
                    </h2>
                    <p className={styles.vendorName}>
                      Vendor: {c.food_packages?.vendors?.business_name || "Railway Contractor"} • Station: {c.food_packages?.vendors?.station_location || "Station"}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <SeverityBadge severity={c.severity} />
                    <StatusBadge status={c.status} />
                  </div>
                </div>

                {/* 6-Stage Progress Stepper */}
                <div className={styles.stepper}>
                  {STAGES.map((stg, idx) => {
                    const isCompleted = idx < currentStageIdx;
                    const isActive = idx === currentStageIdx;

                    return (
                      <div
                        key={stg.key}
                        className={`${styles.stepNode} ${
                          isCompleted ? styles.stepCompleted : isActive ? styles.stepActive : ""
                        }`}
                      >
                        <div className={styles.stepCircle}>
                          {isCompleted ? "✓" : idx + 1}
                        </div>
                        <span className={styles.stepLabel}>{stg.label}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Complaint Summary */}
                <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "8px", fontSize: "0.85rem" }}>
                  <div style={{ marginBottom: "6px" }}>
                    <strong>Issue Category:</strong> {c.issue_type?.replace(/_/g, " ")}
                  </div>
                  <div style={{ marginBottom: "6px" }}>
                    <strong>Description:</strong> {c.description}
                  </div>
                  {c.image_url && (
                    <div style={{ marginTop: "10px" }}>
                      <strong style={{ display: "block", marginBottom: "4px" }}>Evidence Photo:</strong>
                      <img
                        src={c.image_url}
                        alt="Evidence"
                        style={{ maxHeight: "120px", borderRadius: "6px", border: "1px solid var(--border)" }}
                      />
                    </div>
                  )}
                </div>

                {/* Optional Journey & Reference Details */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  <span>
                    Ref: <code style={{ fontFamily: "monospace" }}>{c.id.slice(0, 8)}…</code> • Reported on {formatDate(c.created_at)}
                  </span>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--navy)",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {isExpanded ? "Hide Investigation Trail ▲" : "View Investigation Trail ▼"}
                  </button>
                </div>

                {/* Expanded Action History & Inspector Findings */}
                {isExpanded && (
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: "14px", marginTop: "4px" }}>
                    {/* Inspector Report if available */}
                    {c.inspection_reports && c.inspection_reports.length > 0 && (
                      <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "12px", borderRadius: "8px", marginBottom: "12px" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#166534", marginBottom: "4px" }}>
                          🔍 Official Quality Inspector Findings:
                        </div>
                        <p style={{ fontSize: "0.82rem", color: "#15803d", marginBottom: "4px" }}>
                          {c.inspection_reports[0].findings}
                        </p>
                        {c.inspection_reports[0].remarks && (
                          <p style={{ fontSize: "0.78rem", color: "#166534" }}>
                            Remarks: {c.inspection_reports[0].remarks}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Status History Timeline */}
                    <div style={{ fontSize: "0.82rem" }}>
                      <div style={{ fontWeight: 700, marginBottom: "8px" }}>Status History:</div>
                      {c.complaint_status_history && c.complaint_status_history.length > 0 ? (
                        c.complaint_status_history.map((hist) => (
                          <div key={hist.id} style={{ display: "flex", gap: "10px", marginBottom: "6px" }}>
                            <span style={{ color: "var(--text-muted)", minWidth: "120px" }}>
                              {formatDateTime(hist.created_at)}:
                            </span>
                            <span>
                              Status changed to <strong>{hist.new_status}</strong>
                              {hist.remarks && ` — ${hist.remarks}`}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p style={{ color: "var(--text-muted)" }}>Complaint registered in system.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PassengerLayout>
  );
}
