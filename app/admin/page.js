/* app/admin/page.js — Admin Dashboard
 *
 * WHAT IT DOES:
 *   Fetches real statistics from Supabase and displays:
 *   - KPI cards (total feedback, complaints, pending, resolved, avg rating, vendors)
 *   - Hygiene issue distribution (CSS bar chart — no chart library needed)
 *   - Recent complaints table
 *
 * HOW FRONTEND ↔ BACKEND WORKS:
 *   1. This is a "use client" component.
 *   2. useEffect runs after the page loads in the browser.
 *   3. It calls our API route GET /api/admin/stats.
 *   4. The API route queries Supabase and returns JSON.
 *   5. We store the result in state and render it.
 *
 * WHY useEffect?
 *   We need to fetch data AFTER the component mounts in the browser,
 *   so we use useEffect with an empty [] dependency array —
 *   this means "run once when the page first loads".
 *
 * TABLES USED: feedback, complaints, vendors, food_packages
 *
 * EMPTY STATE:
 *   If the database has no records, every stat shows 0 and the
 *   complaints table shows "No complaints found yet."
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { StatusBadge, SeverityBadge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonCard, SkeletonLine } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/utils";
import { HYGIENE_ISSUES } from "@/lib/constants";
import styles from "./dashboard.module.css";

/* ── KPI Card ─────────────────────────────────────────────────── */
function KpiCard({ icon, label, value, loading }) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiIcon}>{icon}</div>
      {loading ? (
        <SkeletonLine width="60%" height={28} />
      ) : (
        <div className={styles.kpiValue}>{value ?? 0}</div>
      )}
      <div className={styles.kpiLabel}>{label}</div>
    </div>
  );
}

/* ── CSS Bar (replaces Recharts) ─────────────────────────────── */
function HygieneBar({ label, count, max }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className={styles.barRow}>
      <span className={styles.barLabel}>{label}</span>
      <div className={styles.barTrack}>
        <div className={styles.barFill} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.barCount}>{count}</span>
    </div>
  );
}

/* ── Main Dashboard ───────────────────────────────────────────── */
export default function AdminDashboard() {
  const [stats,      setStats]      = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [hygiene,    setHygiene]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [noConfig,   setNoConfig]   = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/stats");
        if (res.status === 503) { setNoConfig(true); setLoading(false); return; }
        if (!res.ok) throw new Error(await res.text());
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

  /* Max value for bar chart scaling */
  const maxHygiene = hygiene.reduce((m, h) => Math.max(m, h.count), 0);

  return (
    <AdminLayout title="Dashboard">
      <div className={styles.page}>

        {/* ── Setup needed ── */}
        {noConfig && (
          <div className={styles.setupBanner}>
            <h3>⚙️ Supabase not configured</h3>
            <p>Open <code>.env.local</code> in the project root and add your credentials:</p>
            <p><code>NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co</code></p>
            <p><code>NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key</code></p>
            <p>Then restart the dev server with <code>npm run dev</code>.</p>
          </div>
        )}

        {/* ── Error ── */}
        {error && <div className={styles.errorBanner}>⚠️ {error}</div>}

        {/* ── KPI Cards ── */}
        <div>
          <h2 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Platform Overview
          </h2>
          {loading ? (
            <div className={styles.skeletonGrid}>
              {[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <div className={styles.kpiGrid}>
              <KpiCard icon="💬" label="Total Feedback"   value={stats?.total_feedback ?? 0}    />
              <KpiCard icon="⚠️" label="Total Complaints" value={stats?.total_complaints ?? 0}  />
              <KpiCard icon="⏳" label="Active / Open"    value={stats?.active_complaints ?? 0} />
              <KpiCard icon="✅" label="Resolved"          value={stats?.resolved_complaints ?? 0} />
              <KpiCard icon="⭐" label="Avg. Rating"       value={stats?.avg_rating ? `${Number(stats.avg_rating).toFixed(1)}★` : "—"} />
              <KpiCard icon="🏪" label="Vendors"           value={stats?.total_vendors ?? 0}     />
              <KpiCard icon="🔍" label="Inspectors"        value={stats?.total_inspectors ?? 0}  />
            </div>
          )}
        </div>

        {/* ── Charts row ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

          {/* Hygiene breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Hygiene Issue Breakdown</CardTitle>
            </CardHeader>
            <CardBody>
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[1,2,3,4].map(i => <SkeletonLine key={i} height={12} />)}
                </div>
              ) : hygiene.length === 0 ? (
                <EmptyState
                  icon="📊"
                  title="No complaint data yet"
                  description="Hygiene breakdown will appear once complaints are submitted."
                />
              ) : (
                <div className={styles.barSection}>
                  {hygiene.map(h => (
                    <HygieneBar
                      key={h.issue_type}
                      label={HYGIENE_ISSUES.find(i => i.value === h.issue_type)?.label ?? h.issue_type}
                      count={h.count}
                      max={maxHygiene}
                    />
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Status summary */}
          <Card>
            <CardHeader>
              <CardTitle>Complaint Status Summary</CardTitle>
            </CardHeader>
            <CardBody>
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[1,2,3,4].map(i => <SkeletonLine key={i} height={12} />)}
                </div>
              ) : !stats ? (
                <EmptyState icon="📋" title="No data yet" description="Stats will show once complaints are filed." />
              ) : (
                <div className={styles.barSection}>
                  {[
                    { label: "Pending Review",    count: stats.pending_complaints ?? 0, color: "#b45309" },
                    { label: "Investigating",     count: (stats.assigned_complaints ?? 0) + (stats.in_progress_complaints ?? 0), color: "#1d4ed8" },
                    { label: "Report Submitted",  count: stats.report_submitted_complaints ?? 0, color: "#0369a1" },
                    { label: "Resolved",          count: stats.resolved_complaints ?? 0, color: "#1a7a4a" },
                    { label: "Reopened",          count: stats.reopened_complaints ?? 0, color: "#c0392b" },
                  ].map(item => {
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
        </div>

        {/* ── Recent Complaints ── */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Complaints</CardTitle>
            <Link href="/admin/complaints" className={styles.viewAll}>View all →</Link>
          </CardHeader>
          <CardBody style={{ padding: 0 }}>
            {loading ? (
              <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 10 }}>
                {[1,2,3].map(i => <SkeletonLine key={i} height={14} />)}
              </div>
            ) : complaints.length === 0 ? (
              <EmptyState
                icon="🗂️"
                title="No complaints yet"
                description="Complaints submitted by passengers will appear here."
              />
            ) : (
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Food Package</th>
                      <th>Vendor</th>
                      <th>Status</th>
                      <th>Severity</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {complaints.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                          {c.id.slice(0, 8)}…
                        </td>
                        <td style={{ fontWeight: 500 }}>
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
