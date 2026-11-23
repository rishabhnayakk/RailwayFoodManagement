/* app/admin/complaints/page.js
 * Complaint Management Portal
 *
 * Displays all passenger food quality complaints.
 * Supports keyword search, status filtering, and severity filtering.
 * Connects to Supabase database. Shows clean empty state if no complaints exist.
 * NO fake data. NO external icon libraries.
 */

"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { StatusBadge, SeverityBadge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonLine } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import styles from "./complaints.module.css";

export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");

  useEffect(() => {
    async function fetchComplaints() {
      setLoading(true);
      const supabase = createClient();
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("complaints")
          .select(`
            id,
            issue_type,
            severity,
            status,
            description,
            created_at,
            food_packages (
              package_name,
              vendors (
                business_name
              )
            )
          `)
          .order("created_at", { ascending: false });

        if (!error && data) {
          setComplaints(data);
        }
      } catch (err) {
        console.error("Error fetching complaints:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchComplaints();
  }, []);

  // Filter complaints based on state selections
  const filtered = complaints.filter((c) => {
    const pkgName = c.food_packages?.package_name?.toLowerCase() || "";
    const vendorName = c.food_packages?.vendors?.business_name?.toLowerCase() || "";
    const issue = c.issue_type?.toLowerCase() || "";
    const term = search.toLowerCase();

    const matchesSearch =
      !term ||
      pkgName.includes(term) ||
      vendorName.includes(term) ||
      issue.includes(term) ||
      c.id.includes(term);

    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    const matchesSeverity = severityFilter === "all" || c.severity === severityFilter;

    return matchesSearch && matchesStatus && matchesSeverity;
  });

  return (
    <AdminLayout title="Complaint Management">
      <div className={styles.container}>
        {/* Search & Filters */}
        <div className={styles.filtersRow}>
          <input
            type="text"
            placeholder="Search by package, vendor, issue, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.select}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="under_review">Under Review</option>
            <option value="resolved">Resolved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className={styles.select}
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* Complaints Table Card */}
        <Card>
          <CardHeader>
            <CardTitle>
              Registered Complaints ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardBody style={{ padding: 0 }}>
            {loading ? (
              <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
                {[1, 2, 3, 4].map((i) => (
                  <SkeletonLine key={i} height={20} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon="⚠️"
                title="No complaints found"
                description={
                  complaints.length === 0
                    ? "No complaints have been submitted yet. Submissions from passengers scanning QR codes will display here."
                    : "No complaints match your active filter criteria."
                }
              />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Complaint ID</th>
                      <th>Food Package</th>
                      <th>Vendor</th>
                      <th>Issue Type</th>
                      <th>Status</th>
                      <th>Severity</th>
                      <th>Reported Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => (
                      <tr key={c.id}>
                        <td className={styles.codeText}>{c.id.slice(0, 8)}…</td>
                        <td style={{ fontWeight: 600 }}>
                          {c.food_packages?.package_name ?? "Unspecified"}
                        </td>
                        <td style={{ color: "var(--text-muted)" }}>
                          {c.food_packages?.vendors?.business_name ?? "—"}
                        </td>
                        <td>{c.issue_type?.replace(/_/g, " ")}</td>
                        <td>
                          <StatusBadge status={c.status} />
                        </td>
                        <td>
                          <SeverityBadge severity={c.severity} />
                        </td>
                        <td style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                          {formatDate(c.created_at)}
                        </td>
                        <td>
                          <button
                            className={styles.actionBtn}
                            onClick={() => alert(`Reviewing details for case ${c.id}`)}
                          >
                            Investigate →
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
      </div>
    </AdminLayout>
  );
}
