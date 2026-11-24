/* app/admin/complaints/page.js
 * Complaint Management Portal
 *
 * Displays all passenger food quality complaints across railway catering.
 * Supports keyword search, 7-stage lifecycle status filtering, and severity filtering.
 * Connects to Supabase database. Shows clean empty state if no complaints exist.
 * NO fake data. NO external icon libraries.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
                business_name,
                station_location
              )
            ),
            profiles!complaints_assigned_inspector_id_fkey (
              full_name
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
    const inspectorName = c.profiles?.full_name?.toLowerCase() || "";
    const term = search.toLowerCase();

    const matchesSearch =
      !term ||
      pkgName.includes(term) ||
      vendorName.includes(term) ||
      issue.includes(term) ||
      inspectorName.includes(term) ||
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
            placeholder="Search by package, vendor, inspector, issue, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.select}
          >
            <option value="all">All Statuses (Lifecycle)</option>
            <option value="submitted">1. Submitted</option>
            <option value="pending_review">2. Pending Review</option>
            <option value="assigned">3. Assigned to Inspector</option>
            <option value="in_progress">4. In Progress</option>
            <option value="report_submitted">5. Report Submitted</option>
            <option value="resolved">6. Resolved / Closed</option>
            <option value="reopened">Reopened</option>
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
                      <th>Complaint Ref</th>
                      <th>Food Package</th>
                      <th>Vendor & Station</th>
                      <th>Issue Type</th>
                      <th>Assigned Inspector</th>
                      <th>Status</th>
                      <th>Severity</th>
                      <th>Date</th>
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
                          {c.food_packages?.vendors?.station_location && (
                            <span style={{ fontSize: "0.75rem", display: "block" }}>
                              📍 {c.food_packages.vendors.station_location}
                            </span>
                          )}
                        </td>
                        <td>{c.issue_type?.replace(/_/g, " ")}</td>
                        <td>
                          {c.profiles?.full_name ? (
                            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--navy)" }}>
                              🔍 {c.profiles.full_name}
                            </span>
                          ) : (
                            <span style={{ fontSize: "0.78rem", color: "#d97706", fontStyle: "italic" }}>
                              Unassigned
                            </span>
                          )}
                        </td>
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
                          <Link
                            href={`/admin/complaints/${c.id}`}
                            style={{
                              display: "inline-block",
                              padding: "6px 12px",
                              background: "var(--navy)",
                              color: "#fff",
                              borderRadius: "6px",
                              fontSize: "0.78rem",
                              fontWeight: 600,
                              textDecoration: "none",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Review & Assign →
                          </Link>
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
