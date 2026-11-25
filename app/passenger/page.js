/* app/passenger/page.js — Passenger Portal Overview */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import PassengerLayout from "@/components/layout/PassengerLayout";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import NavIcon from "@/components/ui/NavIcon";
import { SkeletonLine } from "@/components/ui/Skeleton";
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
      const authData = await getCurrentUserProfile().catch(() => null);
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
  const activeComplaints = complaints.filter((c) => c.status !== "resolved").length;
  const resolvedComplaints = complaints.filter((c) => c.status === "resolved").length;

  return (
    <PassengerLayout>
      <div className={styles.headerStrip}>
        <div>
          <h1 className={styles.welcomeTitle}>
            {profile?.full_name || "Passenger Account"}
          </h1>
          <p className={styles.welcomeDesc}>
            Scan railway meal QR codes, review food quality, and track your complaint status.
          </p>
        </div>
        <Link href="/scan" className={styles.scanCta}>
          <NavIcon name="qr" size={15} />
          <span>Scan Food QR</span>
        </Link>
      </div>

      <div className={styles.summaryLine}>
        <span>Complaints Filed: <strong>{totalComplaints}</strong></span>
        <span>Open / Active: <strong>{activeComplaints}</strong></span>
        <span>Resolved: <strong>{resolvedComplaints}</strong></span>
        <span>Ratings Submitted: <strong>{feedback.length}</strong></span>
      </div>

      <Card style={{ marginBottom: "20px" }}>
        <CardHeader>
          <CardTitle>Recent Complaints</CardTitle>
          <Link
            href="/passenger/complaints"
            style={{ fontSize: "0.82rem", color: "var(--navy)", fontWeight: 600 }}
          >
            Full status tracker →
          </Link>
        </CardHeader>
        <CardBody style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {[1, 2].map((i) => <SkeletonLine key={i} height={18} />)}
            </div>
          ) : complaints.length === 0 ? (
            <EmptyState
              title="No complaints filed"
              description="Scan a meal package QR code if you need to report a food quality or hygiene issue."
            />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#f9fafb", textAlign: "left" }}>
                    <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Package</th>
                    <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Vendor</th>
                    <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Issue</th>
                    <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Status</th>
                    <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Filed</th>
                  </tr>
                </thead>
                <tbody>
                  {complaints.slice(0, 5).map((c) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 600 }}>{c.food_packages?.package_name || "Food Package"}</td>
                      <td style={{ padding: "10px 14px", color: "var(--text-muted)" }}>{c.food_packages?.vendors?.business_name || "—"}</td>
                      <td style={{ padding: "10px 14px" }}>{c.issue_type?.replace(/_/g, " ")}</td>
                      <td style={{ padding: "10px 14px" }}><StatusBadge status={c.status} /></td>
                      <td style={{ padding: "10px 14px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{formatDate(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Food Ratings</CardTitle>
          <Link
            href="/passenger/feedback"
            style={{ fontSize: "0.82rem", color: "var(--navy)", fontWeight: 600 }}
          >
            All ratings →
          </Link>
        </CardHeader>
        <CardBody style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {[1, 2].map((i) => <SkeletonLine key={i} height={18} />)}
            </div>
          ) : feedback.length === 0 ? (
            <EmptyState
              title="No ratings submitted"
              description="Ratings you submit after scanning meal QR codes will be listed here."
            />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#f9fafb", textAlign: "left" }}>
                    <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Package</th>
                    <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Rating</th>
                    <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Comment</th>
                    <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {feedback.slice(0, 5).map((f) => (
                    <tr key={f.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 600 }}>{f.food_packages?.package_name || "Food Package"}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 600, color: "#b45309" }}>{f.rating} / 5</td>
                      <td style={{ padding: "10px 14px", color: "var(--text-muted)" }}>{f.comment || "—"}</td>
                      <td style={{ padding: "10px 14px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{formatDate(f.created_at)}</td>
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
