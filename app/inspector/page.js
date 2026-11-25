/* app/inspector/page.js — Quality Inspector Workbench */

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
import styles from "./inspector.module.css";

export default function InspectorOverviewPage() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInspectorDashboard() {
      setLoading(true);
      const authData = await getCurrentUserProfile().catch(() => null);
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
            id,
            issue_type,
            severity,
            status,
            created_at,
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
        console.error("Error loading inspector cases:", err);
      } finally {
        setLoading(false);
      }
    }

    loadInspectorDashboard();
  }, []);

  const activeQueue = cases.filter((c) =>
    ["assigned", "in_progress", "reopened"].includes(c.status)
  );
  const completedQueue = cases.filter((c) =>
    !["assigned", "in_progress", "reopened"].includes(c.status)
  );

  const metrics = [
    { label: "Total Assigned", value: cases.length },
    { label: "Pending Action", value: cases.filter((c) => c.status === "assigned" || c.status === "reopened").length },
    { label: "In Progress", value: cases.filter((c) => c.status === "in_progress").length },
    { label: "Reports Submitted", value: cases.filter((c) => c.status === "report_submitted").length },
    { label: "Resolved", value: cases.filter((c) => c.status === "resolved").length },
  ];

  return (
    <InspectorLayout title="Investigation Workbench">
      {/* Compact Workload Strip */}
      <section className={styles.summaryStrip}>
        {metrics.map((m) => (
          <div key={m.label} className={styles.summaryCell}>
            {loading ? (
              <SkeletonLine width="50%" height={22} />
            ) : (
              <div className={styles.kpiNumber}>{m.value}</div>
            )}
            <div className={styles.kpiLabel}>{m.label}</div>
          </div>
        ))}
      </section>

      {/* Primary Focus: Active Investigation Queue */}
      <Card style={{ marginBottom: "20px" }}>
        <CardHeader>
          <CardTitle>Active Investigation Queue ({activeQueue.length})</CardTitle>
          <Link
            href="/inspector/cases"
            style={{ fontSize: "0.82rem", color: "var(--navy)", fontWeight: 600 }}
          >
            All assigned cases →
          </Link>
        </CardHeader>
        <CardBody style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {[1, 2, 3].map((i) => <SkeletonLine key={i} height={18} />)}
            </div>
          ) : activeQueue.length === 0 ? (
            <EmptyState
              title="No active investigations"
              description="Complaints assigned to you by Railway Administration will appear in this queue."
            />
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Case ID</th>
                    <th>Food Package</th>
                    <th>Vendor &amp; Station</th>
                    <th>Issue</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Reported</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeQueue.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{c.id.slice(0, 8)}</td>
                      <td style={{ fontWeight: 600 }}>{c.food_packages?.package_name || "Food Package"}</td>
                      <td style={{ color: "var(--text-muted)" }}>
                        {c.food_packages?.vendors?.business_name || "—"}
                        {c.food_packages?.vendors?.station_location ? ` (${c.food_packages.vendors.station_location})` : ""}
                      </td>
                      <td>{c.issue_type?.replace(/_/g, " ")}</td>
                      <td><SeverityBadge severity={c.severity} /></td>
                      <td><StatusBadge status={c.status} /></td>
                      <td style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{formatDate(c.created_at)}</td>
                      <td>
                        <Link
                          href={`/inspector/cases/${c.id}`}
                          style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--navy)", textDecoration: "underline" }}
                        >
                          Open File
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

      {/* Secondary: Filed / Closed Cases */}
      {completedQueue.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Submitted &amp; Reviewed Cases ({completedQueue.length})</CardTitle>
            <Link
              href="/inspector/history"
              style={{ fontSize: "0.82rem", color: "var(--navy)", fontWeight: 600 }}
            >
              Report archive →
            </Link>
          </CardHeader>
          <CardBody style={{ padding: 0 }}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Case ID</th>
                    <th>Food Package</th>
                    <th>Vendor</th>
                    <th>Status</th>
                    <th>Reported</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {completedQueue.slice(0, 5).map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{c.id.slice(0, 8)}</td>
                      <td style={{ fontWeight: 600 }}>{c.food_packages?.package_name || "Food Package"}</td>
                      <td style={{ color: "var(--text-muted)" }}>{c.food_packages?.vendors?.business_name || "—"}</td>
                      <td><StatusBadge status={c.status} /></td>
                      <td style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{formatDate(c.created_at)}</td>
                      <td>
                        <Link
                          href={`/inspector/cases/${c.id}`}
                          style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--navy)" }}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </InspectorLayout>
  );
}
