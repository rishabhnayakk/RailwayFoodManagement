/* app/passenger/page.js
 * Passenger Dashboard Main Overview
 * Summarizes passenger's submitted feedback, active complaints, and quick scan action.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import PassengerLayout from "@/components/layout/PassengerLayout";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { StatusBadge, SeverityBadge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonCard, SkeletonLine } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserProfile } from "@/lib/auth";
import styles from "./passenger.module.css";

export default function PassengerDashboardPage() {
  const [profile, setProfile] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPassengerData() {
      setLoading(true);
      const authData = await getCurrentUserProfile();
      if (!authData?.user) {
        setLoading(false);
        return;
      }

      setProfile(authData.profile);
      const supabase = createClient();
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        const [compRes, feedRes] = await Promise.all([
          supabase
            .from("complaints")
            .select(`
              id,
              issue_type,
              severity,
              status,
              created_at,
              food_packages (
                package_name,
                vendors (business_name)
              )
            `)
            .eq("passenger_id", authData.user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("feedback")
            .select(`
              id,
              rating,
              comment,
              created_at,
              food_packages (
                package_name,
                vendors (business_name)
              )
            `)
            .eq("passenger_id", authData.user.id)
            .order("created_at", { ascending: false }),
        ]);

        if (compRes.data) setComplaints(compRes.data);
        if (feedRes.data) setFeedback(feedRes.data);
      } catch (err) {
        console.error("Error loading passenger overview:", err);
      } finally {
        setLoading(false);
      }
    }

    loadPassengerData();
  }, []);

  const totalComplaints = complaints.length;
  const activeComplaints = complaints.filter(
    (c) => c.status !== "resolved"
  ).length;
  const resolvedComplaints = complaints.filter(
    (c) => c.status === "resolved"
  ).length;
  const totalFeedback = feedback.length;

  return (
    <PassengerLayout>
      {/* Welcome Banner */}
      <div className={styles.welcomeCard}>
        <div>
          <h1 className={styles.welcomeTitle}>
            Welcome, {profile?.full_name || "Passenger"} 👋
          </h1>
          <p className={styles.welcomeDesc}>
            Indian Railways Food Quality & Hygiene Monitoring System
          </p>
        </div>
        <Link href="/scan" className={styles.scanCta}>
          📱 Scan Food QR Code
        </Link>
      </div>

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
            <div className={styles.kpiIcon}>⚠️</div>
            <div className={styles.kpiNumber}>{totalComplaints}</div>
            <div className={styles.kpiLabel}>Total Complaints</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiIcon}>⏳</div>
            <div className={styles.kpiNumber}>{activeComplaints}</div>
            <div className={styles.kpiLabel}>Under Investigation</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiIcon}>✅</div>
            <div className={styles.kpiNumber}>{resolvedComplaints}</div>
            <div className={styles.kpiLabel}>Resolved Complaints</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiIcon}>⭐</div>
            <div className={styles.kpiNumber}>{totalFeedback}</div>
            <div className={styles.kpiLabel}>Ratings Submitted</div>
          </div>
        </div>
      )}

      {/* Recent Complaints Table */}
      <Card style={{ marginBottom: "24px" }}>
        <CardHeader>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <CardTitle>Recent Food Complaints</CardTitle>
            <Link
              href="/passenger/complaints"
              style={{ fontSize: "0.85rem", color: "var(--navy)", fontWeight: 600 }}
            >
              View Full Tracker →
            </Link>
          </div>
        </CardHeader>
        <CardBody style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {[1, 2].map((i) => (
                <SkeletonLine key={i} height={18} />
              ))}
            </div>
          ) : complaints.length === 0 ? (
            <EmptyState
              icon="📭"
              title="No complaints filed yet"
              description="If you encounter poor food quality, foreign objects, or packaging defects, scan the package QR code to lodge an official complaint."
            />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                    <th style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>Package</th>
                    <th style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>Vendor</th>
                    <th style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>Issue</th>
                    <th style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>Status</th>
                    <th style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>Reported</th>
                  </tr>
                </thead>
                <tbody>
                  {complaints.slice(0, 5).map((c) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                        {c.food_packages?.package_name || "Food Package"}
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>
                        {c.food_packages?.vendors?.business_name || "—"}
                      </td>
                      <td style={{ padding: "12px 16px" }}>{c.issue_type?.replace(/_/g, " ")}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <StatusBadge status={c.status} />
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
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
    </PassengerLayout>
  );
}
