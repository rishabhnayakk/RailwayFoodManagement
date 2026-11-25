/* app/vendor/complaints/page.js
 * Vendor Complaints & Inspection Status View
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import VendorLayout from "@/components/layout/VendorLayout";
import EmptyState from "@/components/ui/EmptyState";
import { StatusBadge, SeverityBadge } from "@/components/ui/Badge";
import { getCurrentUserProfile } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import styles from "../vendor.module.css";

export default function VendorComplaintsPage() {
  const router = useRouter();
  const [complaints, setComplaints] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadComplaints() {
      setLoading(true);
      try {
        const account = await getCurrentUserProfile();
        if (!account?.profile || account.profile.role !== "vendor") {
          router.replace("/vendor/login");
          return;
        }

        const res = await fetch("/api/vendor/complaints");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load complaints.");
        setComplaints(data.complaints || []);
      } catch (e) {
        setError(e.message || "Unable to load complaints.");
      } finally {
        setLoading(false);
      }
    }

    loadComplaints();
  }, [router]);

  const filtered = complaints.filter(
    (c) => statusFilter === "all" || c.status === statusFilter
  );

  return (
    <VendorLayout title="Package Complaints & Inspection Status">
      {loading ? (
        <div className={styles.loading}>Loading complaints…</div>
      ) : error ? (
        <div className={styles.errorBox} role="alert">
          <strong>⚠️ {error}</strong>
        </div>
      ) : (
        <div className={styles.page}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
              Complaints associated with your food packages: <strong>{complaints.length}</strong>
            </p>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                background: "#fff",
                fontSize: "0.875rem",
              }}
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="report_submitted">Report Submitted</option>
              <option value="unable_to_resolve">Unable to Resolve</option>
              <option value="escalated">Escalated</option>
              <option value="resolved">Resolved</option>
              <option value="reopened">Reopened</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon="✅"
              title="No matching complaints"
              description="No passenger complaints match this filter for your catering packages."
            />
          ) : (
            <section className={styles.section}>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Package</th>
                      <th>Issue Category</th>
                      <th>Description</th>
                      <th>Severity</th>
                      <th>Status</th>
                      <th>Inspection Status</th>
                      <th>Filed On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => (
                      <tr key={c.id}>
                        <td className={styles.bold}>{c.food_packages?.package_name || "Food Package"}</td>
                        <td>{c.issue_type?.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase()) || "—"}</td>
                        <td style={{ maxWidth: "300px", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                          {c.description}
                        </td>
                        <td><SeverityBadge severity={c.severity} /></td>
                        <td><StatusBadge status={c.status} /></td>
                        <td style={{ fontSize: "0.8rem", color: "var(--navy)", fontWeight: 600 }}>
                          {c.inspection_status || "Monitoring"}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>{formatDate(c.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <p className={styles.disclaimer}>
            Passenger identity and confidential field inspection details are protected by Railway Privacy Policy.
          </p>
        </div>
      )}
    </VendorLayout>
  );
}
