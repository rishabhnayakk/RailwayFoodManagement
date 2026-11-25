/* app/admin/page.js — Admin Operations Dashboard */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { StatusBadge, SeverityBadge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonLine } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/utils";
import { HYGIENE_ISSUES } from "@/lib/constants";
import styles from "./dashboard.module.css";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [hygiene, setHygiene] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [noConfig, setNoConfig] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/stats");
        if (res.status === 503) {
          setNoConfig(true);
          setLoading(false);
          return;
        }
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error || "Failed to load dashboard statistics.");
        }
        const data = await res.json();
        setStats(data.stats);
        setComplaints(data.recentComplaints ?? []);
        setHygiene(data.hygieneCounts ?? []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const maxHygiene = hygiene.reduce((m, h) => Math.max(m, h.count), 0);

  const metricItems = [
    { label: "Total Vendors", value: stats?.total_vendors ?? 0 },
    { label: "Active Vendors", value: stats?.active_vendors ?? 0 },
    { label: "Suspended Vendors", value: stats?.suspended_vendors ?? 0 },
    { label: "Total Inspectors", value: stats?.total_inspectors ?? 0 },
    { label: "Pending Approvals", value: stats?.pending_packages ?? 0 },
    { label: "Total Complaints", value: stats?.total_complaints ?? 0 },
    { label: "Pending Complaints", value: stats?.pending_complaints ?? 0 },
    { label: "In-Progress", value: stats?.investigating_complaints ?? 0 },
    { label: "Resolved", value: stats?.resolved_complaints ?? 0 },
    { label: "Reopened", value: stats?.reopened_complaints ?? 0 },
    { label: "Feedback Count", value: stats?.total_feedback ?? 0 },
    { label: "Avg Rating", value: stats?.avg_rating ? `${Number(stats.avg_rating).toFixed(1)} / 5` : "—" },
  ];

  return (
    <AdminLayout title="Operations Overview">
      <div className={styles.page}>
        {noConfig && (
          <div className={styles.setupBanner}>
            <h3>Supabase configuration required</h3>
            <p>Add your credentials to <code>.env.local</code> in the project root:</p>
            <p><code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, <code>SUPABASE_SERVICE_ROLE_KEY</code></p>
          </div>
        )}

        {error && <div className={styles.errorBanner}>{error}</div>}

        <div className={styles.quickLinks}>
          <Link href="/admin/vendors" className={styles.quickLink}>Manage Vendors</Link>
          <Link href="/admin/inspectors" className={styles.quickLink}>Manage Inspectors</Link>
          <Link href="/admin/qr-codes" className={styles.quickLink}>Package Approvals</Link>
          <Link href="/admin/complaints" className={styles.quickLink}>Assign &amp; Review Complaints</Link>
        </div>

        {/* Single Unified Summary Strip */}
        <section className={styles.metricsStrip} aria-label="Platform metrics">
          {metricItems.map((m) => (
            <div key={m.label} className={styles.metricCell}>
              {loading ? (
                <SkeletonLine width="60%" height={22} />
              ) : (
                <div className={styles.metricValue}>{m.value}</div>
              )}
              <div className={styles.metricLabel}>{m.label}</div>
            </div>
          ))}
        </section>

        {/* Primary Action Queue: Recent Complaints Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Passenger Complaints</CardTitle>
            <Link href="/admin/complaints" className={styles.viewAll}>View all complaints →</Link>
          </CardHeader>
          <CardBody style={{ padding: 0 }}>
            {loading ? (
              <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: 10 }}>
                {[1, 2, 3].map((i) => <SkeletonLine key={i} height={14} />)}
              </div>
            ) : complaints.length === 0 ? (
              <EmptyState
                title="No complaints filed yet"
                description="Passenger complaints registered through QR verification will appear here for inspector assignment."
              />
            ) : (
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>Complaint ID</th>
                      <th>Food Package</th>
                      <th>Vendor</th>
                      <th>Status</th>
                      <th>Severity</th>
                      <th>Filed Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {complaints.map((c) => (
                      <tr key={c.id}>
                        <td style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                          {c.id.slice(0, 8)}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {c.food_packages?.package_name ?? "—"}
                        </td>
                        <td style={{ color: "var(--text-muted)" }}>
                          {c.food_packages?.vendors?.business_name ?? "—"}
                        </td>
                        <td><StatusBadge status={c.status} /></td>
                        <td><SeverityBadge severity={c.severity} /></td>
                        <td style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                          {formatDate(c.created_at)}
                        </td>
                        <td>
                          <Link href={`/admin/complaints/${c.id}`} className={styles.viewAll}>
                            Review
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

        {/* Secondary Breakdown Row */}
        <div className={styles.chartsRow}>
          <Card>
            <CardHeader>
              <CardTitle>Complaint Lifecycle Breakdown</CardTitle>
            </CardHeader>
            <CardBody>
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[1, 2, 3, 4].map((i) => <SkeletonLine key={i} height={12} />)}
                </div>
              ) : !stats ? (
                <EmptyState title="No statistics available" description="Connect Supabase to view complaint distribution." />
              ) : (
                <div className={styles.barSection}>
                  {[
                    { label: "Submitted / Pending", count: stats.pending_complaints ?? 0, color: "#b45309" },
                    { label: "Assigned / In Progress", count: stats.investigating_complaints ?? 0, color: "#1d4ed8" },
                    { label: "Report Submitted", count: stats.report_submitted_complaints ?? 0, color: "#0369a1" },
                    { label: "Unable / Escalated", count: (stats.unable_to_resolve_complaints ?? 0) + (stats.escalated_complaints ?? 0), color: "#9d174d" },
                    { label: "Resolved", count: stats.resolved_complaints ?? 0, color: "#15803d" },
                    { label: "Reopened", count: stats.reopened_complaints ?? 0, color: "#b91c1c" },
                  ].map((item) => {
                    const total = stats.total_complaints || 1;
                    return (
                      <div key={item.label} className={styles.barRow}>
                        <span className={styles.barLabel}>{item.label}</span>
                        <div className={styles.barTrack}>
                          <div
                            className={styles.barFill}
                            style={{ width: `${Math.round((item.count / total) * 100)}%`, background: item.color }}
                          />
                        </div>
                        <span className={styles.barCount}>{item.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Complaints by Category</CardTitle>
            </CardHeader>
            <CardBody>
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[1, 2, 3, 4].map((i) => <SkeletonLine key={i} height={12} />)}
                </div>
              ) : hygiene.length === 0 ? (
                <EmptyState
                  title="No category data"
                  description="Category counts will populate once passenger complaints are recorded."
                />
              ) : (
                <div className={styles.barSection}>
                  {hygiene.map((h) => {
                    const label = HYGIENE_ISSUES.find((i) => i.value === h.issue_type)?.label ?? h.issue_type.replace(/_/g, " ");
                    const pct = maxHygiene > 0 ? Math.round((h.count / maxHygiene) * 100) : 0;
                    return (
                      <div key={h.issue_type} className={styles.barRow}>
                        <span className={styles.barLabel}>{label}</span>
                        <div className={styles.barTrack}>
                          <div className={styles.barFill} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={styles.barCount}>{h.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
