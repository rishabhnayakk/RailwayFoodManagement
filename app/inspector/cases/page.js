/* app/inspector/cases/page.js
 * Quality Inspector Assigned Cases List
 * Strictly lists complaints assigned to the logged-in inspector.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import InspectorLayout from "@/components/layout/InspectorLayout";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { StatusBadge, SeverityBadge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonLine } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserProfile } from "@/lib/auth";
import styles from "../inspector.module.css";

export default function InspectorCasesPage() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    async function loadCases() {
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
              vendors (
                business_name,
                station_location
              )
            )
          `)
          .eq("assigned_inspector_id", authData.user.id)
          .order("created_at", { ascending: false });

        if (!error && data) {
          setCases(data);
        }
      } catch (err) {
        console.error("Error loading assigned cases:", err);
      } finally {
        setLoading(false);
      }
    }

    loadCases();
  }, []);

  const filtered = cases.filter((c) => {
    if (statusFilter === "all") return true;
    return c.status === statusFilter;
  });

  return (
    <InspectorLayout title="Assigned Quality Complaints">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
          Showing <strong>{filtered.length}</strong> cases assigned to you for official inspection
        </p>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: "8px 14px",
            border: "1.5px solid var(--border)",
            borderRadius: "6px",
            fontSize: "0.85rem",
            background: "var(--surface)",
            cursor: "pointer",
          }}
        >
          <option value="all">All Assigned Statuses</option>
          <option value="assigned">Newly Assigned</option>
          <option value="in_progress">Investigation In Progress</option>
          <option value="report_submitted">Report Submitted</option>
          <option value="resolved">Resolved / Closed</option>
        </select>
      </div>

      <Card>
        <CardBody style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {[1, 2, 3, 4].map((i) => (
                <SkeletonLine key={i} height={20} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="📋"
              title="No complaints found"
              description={
                cases.length === 0
                  ? "You have no complaints assigned by the Railway Quality Administration."
                  : "No assigned complaints match the selected status filter."
              }
            />
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Ref ID</th>
                    <th>Package Name</th>
                    <th>Vendor & Station</th>
                    <th>Defect / Issue</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Assigned Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                        {c.id.slice(0, 8)}…
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {c.food_packages?.package_name || "Food Package"}
                      </td>
                      <td style={{ color: "var(--text-muted)" }}>
                        {c.food_packages?.vendors?.business_name || "—"} ({c.food_packages?.vendors?.station_location || "Station"})
                      </td>
                      <td>{c.issue_type?.replace(/_/g, " ")}</td>
                      <td>
                        <SeverityBadge severity={c.severity} />
                      </td>
                      <td>
                        <StatusBadge status={c.status} />
                      </td>
                      <td style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {formatDate(c.created_at)}
                      </td>
                      <td>
                        <Link
                          href={`/inspector/cases/${c.id}`}
                          style={{
                            display: "inline-block",
                            padding: "6px 12px",
                            background: "var(--navy)",
                            color: "#fff",
                            borderRadius: "6px",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            textDecoration: "none",
                          }}
                        >
                          Investigate Case →
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
    </InspectorLayout>
  );
}
