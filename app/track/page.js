/* app/track/page.js — Public Complaint Tracking Page (By Unique Complaint ID) */

"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import { StatusBadge, SeverityBadge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils";
import styles from "./track.module.css";

const TRACKING_STAGES = [
  { key: "submitted", label: "Registered" },
  { key: "assigned", label: "Assigned" },
  { key: "in_progress", label: "In Progress" },
  { key: "report_submitted", label: "Report Filed" },
  { key: "resolved", label: "Resolved" },
];

function getStageIndex(status) {
  const map = {
    submitted: 0,
    pending_review: 0,
    assigned: 1,
    reopened: 1,
    in_progress: 2,
    report_submitted: 3,
    unable_to_resolve: 3,
    escalated: 3,
    resolved: 4,
  };
  return map[status] ?? 0;
}

function TrackComplaintContent() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get("id") || "";

  const [complaintIdInput, setComplaintIdInput] = useState(initialId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [complaint, setComplaint] = useState(null);

  async function lookupComplaint(targetId) {
    const cleaned = String(targetId || "").trim();
    if (!cleaned) {
      setError("Please enter your Complaint ID (e.g. RG-2026-A8F42K).");
      return;
    }

    setLoading(true);
    setError("");
    setComplaint(null);

    try {
      const res = await fetch(`/api/complaints/track?id=${encodeURIComponent(cleaned)}`);
      const data = await res.json();

      if (!res.ok || !data.found) {
        setError(data.error || "Complaint not found.");
        return;
      }

      setComplaint(data.complaint);
    } catch (err) {
      setError("Unable to check complaint status right now: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!initialId) return;
    const timer = setTimeout(() => {
      lookupComplaint(initialId);
    }, 0);
    return () => clearTimeout(timer);
  }, [initialId]);

  function handleSubmit(e) {
    e.preventDefault();
    lookupComplaint(complaintIdInput);
  }

  const stageIdx = getStageIndex(complaint?.status);

  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <Link href="/" className={styles.backLink}>
          ← Back to Homepage
        </Link>
        <div className={styles.brand}>RAILGUARD · Complaint Tracker</div>
      </header>

      <main className={styles.main}>
        <section className={styles.searchCard}>
          <h1 className={styles.title}>Track Complaint Status</h1>
          <p className={styles.subtitle}>
            Enter your unique RailGuard Complaint ID (such as <code>RG-2026-A8F42K</code>) to view real-time investigation status and progress updates.
          </p>

          <form onSubmit={handleSubmit} className={styles.searchForm}>
            <input
              type="text"
              value={complaintIdInput}
              onChange={(e) => setComplaintIdInput(e.target.value.toUpperCase())}
              placeholder="Enter Complaint ID (e.g. RG-2026-A8F42K)"
              className={styles.input}
              aria-label="Complaint ID"
              required
            />
            <Button type="submit" variant="primary" loading={loading}>
              Track Status
            </Button>
          </form>

          {error && (
            <div className={styles.errorBox} role="alert">
              {error}
            </div>
          )}
        </section>

        {complaint && (
          <section className={styles.resultCard} aria-live="polite">
            <div className={styles.resultHeader}>
              <div>
                <div className={styles.refLabel}>Complaint Reference ID</div>
                <div className={styles.refValue}>{complaint.complaint_ref}</div>
              </div>
              <div className={styles.badges}>
                <SeverityBadge severity={complaint.severity} />
                <StatusBadge status={complaint.status} />
              </div>
            </div>

            {/* Progress Stepper */}
            <div className={styles.stepper}>
              {TRACKING_STAGES.map((stg, idx) => {
                const isDone = idx < stageIdx;
                const isActive = idx === stageIdx;
                return (
                  <div
                    key={stg.key}
                    className={`${styles.stepNode} ${
                      isDone ? styles.stepDone : isActive ? styles.stepActive : ""
                    }`}
                  >
                    <div className={styles.stepCircle}>{isDone ? "✓" : idx + 1}</div>
                    <span className={styles.stepLabel}>{stg.label}</span>
                  </div>
                );
              })}
            </div>

            {["unable_to_resolve", "escalated", "reopened"].includes(complaint.status) && (
              <div className={styles.statusAlert}>
                Current Special Status: <StatusBadge status={complaint.status} />
              </div>
            )}

            {/* Real Complaint Metadata */}
            <div className={styles.detailsGrid}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Issue Category</span>
                <span className={styles.detailValue}>
                  {complaint.issue_type?.replace(/_/g, " ") || "—"}
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Registered On</span>
                <span className={styles.detailValue}>{formatDateTime(complaint.created_at)}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Food Package</span>
                <span className={styles.detailValue}>
                  {complaint.package?.package_name || "Authorized Meal Package"}
                  {complaint.package?.vendor_name ? ` — ${complaint.package.vendor_name}` : ""}
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Assigned Inspector</span>
                <span className={styles.detailValue}>
                  {complaint.assigned_inspector_name || "Awaiting assignment"}
                </span>
              </div>
            </div>

            <div className={styles.descBox}>
              <span className={styles.detailLabel}>Complaint Description</span>
              <p className={styles.descText}>{complaint.description}</p>
            </div>

            {/* Chronological Status Timeline */}
            <div className={styles.timelineSection}>
              <h2 className={styles.timelineHeading}>Status Progress Timeline</h2>
              {complaint.timeline && complaint.timeline.length > 0 ? (
                <div className={styles.timeline}>
                  {complaint.timeline.map((entry) => (
                    <div key={entry.id} className={styles.timelineItem}>
                      <div className={styles.timelineDot} />
                      <div className={styles.timelineContent}>
                        <div className={styles.timelineTop}>
                          <span className={styles.timelineStatus}>
                            {entry.new_status?.replace(/_/g, " ")}
                          </span>
                          <span className={styles.timelineDate}>
                            {formatDateTime(entry.created_at)}
                          </span>
                        </div>
                        {entry.remarks && (
                          <p className={styles.timelineRemarks}>{entry.remarks}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyTimeline}>
                  Complaint registered on {formatDateTime(complaint.created_at)}.
                </p>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default function TrackComplaintPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
          Loading complaint tracker…
        </div>
      }
    >
      <TrackComplaintContent />
    </Suspense>
  );
}
