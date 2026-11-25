/* app/inspector/history/page.js
 * Quality Inspector Investigation History
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import InspectorLayout from "@/components/layout/InspectorLayout";
import { Card, CardBody } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonLine } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserProfile } from "@/lib/auth";
import styles from "../inspector.module.css";

export default function InspectorHistoryPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReports() {
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
          .from("inspection_reports")
          .select(`
            *,
            complaints (
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
            )
          `)
          .eq("inspector_id", authData.user.id)
          .order("created_at", { ascending: false });

        if (!error && data) {
          setReports(data);
        }
      } catch (err) {
        console.error("Error loading history:", err);
      } finally {
        setLoading(false);
      }
    }

    loadReports();
  }, []);

  return (
    <InspectorLayout title="Investigation History & Filed Reports">
      <div style={{ marginBottom: "20px" }}>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
          Showing <strong>{reports.length}</strong> official quality inspection reports filed by your office.
        </p>
      </div>

      <Card>
        <CardBody style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {[1, 2, 3].map((i) => (
                <SkeletonLine key={i} height={20} />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <EmptyState
              icon="📜"
              title="No inspection reports filed yet"
              description="When you investigate assigned complaints and submit formal quality audit reports, they will be archived here."
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
                  View Active Assigned Cases →
                </Link>
              }
            />
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Investigation Date</th>
                    <th>Case Ref</th>
                    <th>Package & Vendor</th>
                    <th>Problem Identified</th>
                    <th>Action Taken</th>
                    <th>Outcome</th>
                    <th>Case Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id}>
                      <td style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {formatDate(r.investigation_date || r.created_at)}
                      </td>
                      <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                        {r.complaint_id?.slice(0, 8)}…
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {r.complaints?.food_packages?.package_name || "Food Package"}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                          {r.complaints?.food_packages?.vendors?.business_name || "—"}
                        </div>
                      </td>
                      <td style={{ maxWidth: "220px", fontSize: "0.82rem" }}>
                        {r.problem_identified || r.findings}
                      </td>
                      <td style={{ maxWidth: "220px", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                        {r.action_taken || r.remarks || "—"}
                      </td>
                      <td>
                        <StatusBadge status={r.recommended_status || "report_submitted"} />
                      </td>
                      <td>
                        <StatusBadge status={r.complaints?.status || "report_submitted"} />
                      </td>
                      <td>
                        <Link
                          href={`/inspector/cases/${r.complaint_id}`}
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
                          View Case File →
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
