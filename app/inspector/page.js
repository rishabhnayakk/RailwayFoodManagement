/* app/inspector/page.js
 * Quality Inspector Overview Dashboard
 * Displays metrics for cases assigned specifically to this inspector.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import InspectorLayout from "@/components/layout/InspectorLayout";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { StatusBadge, SeverityBadge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonCard, SkeletonLine } from "@/components/ui/Skeleton";
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

  const totalAssigned = cases.length;
  const pendingCases = cases.filter(
    (c) => c.status === "assigned" || c.status === "in_progress"
  ).length;
  const submittedReports = cases.filter(
    (c) => c.status === "report_submitted"
  ).length;
  const resolvedCases = cases.filter((c) => c.status === "resolved").length;

  return (
    <InspectorLayout title="Inspector Dashboard">
      {/* KPI Counters */}
      {loading ? (
        <div className={styles.kpiRow}>
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className={styles.kpiRow}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiIcon}>📋</div>
            <div className={styles.kpiNumber}>{totalAssigned}</div>
            <div className={styles.kpiLabel}>Total Cases Assigned</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiIcon}>⏳</div>
            <div className={styles.kpiNumber}>{pendingCases}</div>
            <div className={styles.kpiLabel}>Pending Investigation</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiIcon}>📝</div>
            <div className={styles.kpiNumber}>{submittedReports}</div>
            <div className={styles.kpiLabel}>Reports Submitted</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiIcon}>✅</div>
            <div className={styles.kpiNumber}>{resolvedCases}</div>
            <div className={styles.kpiLabel}>Resolved Cases</div>
          </div>
        </div>
      )}

      {/* Assigned Cases Table */}
      <Card>
        <CardHeader>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <CardTitle>Recent Assigned Quality Cases ({cases.length})</CardTitle>
            <Link
              href="/inspector/cases"
              style={{ fontSize: "0.85rem", color: "var(--navy)", fontWeight: 600 }}
            >
              View All Cases →
            </Link>
          </div>
        </CardHeader>
        <CardBody style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {[1, 2, 3].map((i) => (
                <SkeletonLine key={i} height={20} />
              ))}
            </div>
          ) : cases.length === 0 ? (
            <EmptyState
              icon="🔍"
              title="No complaints assigned yet"
              description="You have zero active investigation assignments. Complaints assigned to you by Railway Administration will appear here."
            />
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Case Ref</th>
                    <th>Food Package</th>
                    <th>Vendor</th>
                    <th>Issue Type</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Reported</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.slice(0, 5).map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                        {c.id.slice(0, 8)}…
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {c.food_packages?.package_name || "Food Package"}
                      </td>
                      <td style={{ color: "var(--text-muted)" }}>
                        {c.food_packages?.vendors?.business_name || "—"}
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
                            fontSize: "0.82rem",
                            fontWeight: 700,
                            color: "var(--navy)",
                            textDecoration: "underline",
                          }}
                        >
                          Investigate →
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
