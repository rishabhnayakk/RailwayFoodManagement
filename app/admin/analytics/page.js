/* app/admin/analytics/page.js
 * Admin quality analytics computed from Supabase `complaints` and `feedback`.
 */

"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonLine } from "@/components/ui/Skeleton";
import { createClient } from "@/lib/supabase/client";
import { HYGIENE_ISSUES } from "@/lib/constants";
import styles from "./analytics.module.css";

export default function AnalyticsPage() {
  const [complaints, setComplaints] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalytics() {
      setLoading(true);
      const supabase = createClient();
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        const [compRes, feedRes] = await Promise.all([
          supabase.from("complaints").select("id, status, severity, issue_type"),
          supabase.from("feedback").select("id, rating"),
        ]);

        if (compRes.data) setComplaints(compRes.data);
        if (feedRes.data) setFeedback(feedRes.data);
      } catch (err) {
        console.error("Error loading analytics:", err);
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, []);

  // Compute issue type distribution
  const issueCounts = {};
  complaints.forEach((c) => {
    const key = c.issue_type || "other";
    issueCounts[key] = (issueCounts[key] || 0) + 1;
  });

  const totalComplaints = complaints.length;

  // Compute rating breakdown (1 to 5)
  const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let ratingSum = 0;
  feedback.forEach((f) => {
    if (f.rating >= 1 && f.rating <= 5) {
      ratingCounts[f.rating] = (ratingCounts[f.rating] || 0) + 1;
      ratingSum += f.rating;
    }
  });

  const totalFeedback = feedback.length;
  const avgRating = totalFeedback > 0 ? (ratingSum / totalFeedback).toFixed(1) : null;

  return (
    <AdminLayout title="Analytics & Quality Reports">
      <div className={styles.container}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <SkeletonLine height={24} width="40%" />
            <SkeletonLine height={80} />
            <SkeletonLine height={80} />
          </div>
        ) : totalComplaints === 0 && totalFeedback === 0 ? (
          <EmptyState
            icon="📊"
            title="No audit data recorded yet"
            description="Once passengers submit ratings and report quality issues, performance breakdowns will calculate automatically."
          />
        ) : (
          <div className={styles.grid}>
            {/* Rating Distribution Card */}
            <Card>
              <CardHeader>
                <CardTitle>Food Quality Ratings ({totalFeedback} Reviews)</CardTitle>
              </CardHeader>
              <CardBody>
                {avgRating && (
                  <div style={{ marginBottom: "16px", textAlign: "center" }}>
                    <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "var(--navy)" }}>
                      {avgRating} <span className={styles.ratingStars}>★</span>
                    </div>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      Overall Passenger Satisfaction Average
                    </p>
                  </div>
                )}
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = ratingCounts[stars] || 0;
                  const pct = totalFeedback > 0 ? Math.round((count / totalFeedback) * 100) : 0;
                  return (
                    <div key={stars} style={{ marginBottom: "10px" }}>
                      <div className={styles.statRow} style={{ border: "none", padding: 0 }}>
                        <span>{stars} Stars</span>
                        <span>
                          <strong>{count}</strong> ({pct}%)
                        </span>
                      </div>
                      <div className={styles.barTrack}>
                        <div
                          className={styles.barFill}
                          style={{
                            width: `${pct}%`,
                            background: stars >= 4 ? "var(--green)" : stars === 3 ? "var(--amber)" : "var(--red)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardBody>
            </Card>

            {/* Hygiene Issues Distribution Card */}
            <Card>
              <CardHeader>
                <CardTitle>Hygiene Issues Distribution ({totalComplaints} Complaints)</CardTitle>
              </CardHeader>
              <CardBody>
                {Object.keys(issueCounts).length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                    No hygiene complaints filed.
                  </p>
                ) : (
                  Object.entries(issueCounts).map(([issueKey, count]) => {
                    const label = HYGIENE_ISSUES.find((i) => i.value === issueKey)?.label || issueKey;
                    const pct = totalComplaints > 0 ? Math.round((count / totalComplaints) * 100) : 0;
                    return (
                      <div key={issueKey} style={{ marginBottom: "12px" }}>
                        <div className={styles.statRow} style={{ border: "none", padding: 0 }}>
                          <span>{label}</span>
                          <span>
                            <strong>{count}</strong> ({pct}%)
                          </span>
                        </div>
                        <div className={styles.barTrack}>
                          <div
                            className={styles.barFill}
                            style={{ width: `${pct}%`, background: "var(--red)" }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
