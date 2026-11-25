/* app/passenger/feedback/page.js
 * Passenger Food Ratings & Feedback History
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import PassengerLayout from "@/components/layout/PassengerLayout";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserProfile } from "@/lib/auth";

export default function PassengerFeedbackPage() {
  const [feedbackList, setFeedbackList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFeedback() {
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
          .from("feedback")
          .select(`
            id,
            rating,
            comment,
            created_at,
            food_packages (
              package_name,
              category,
              vendors (
                business_name,
                station_location
              )
            )
          `)
          .eq("passenger_id", authData.user.id)
          .order("created_at", { ascending: false });

        if (!error && data) {
          setFeedbackList(data);
        }
      } catch (err) {
        console.error("Error loading feedback history:", err);
      } finally {
        setLoading(false);
      }
    }

    loadFeedback();
  }, []);

  return (
    <PassengerLayout>
      <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--text)" }}>
            My Food Quality Ratings
          </h1>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Ratings submitted on authorized railway food packages
          </p>
        </div>
        <Link
          href="/scan"
          style={{
            background: "var(--green)",
            color: "#fff",
            padding: "9px 16px",
            borderRadius: "8px",
            fontSize: "0.85rem",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          📱 Scan & Rate Food
        </Link>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {[1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : feedbackList.length === 0 ? (
        <EmptyState
          icon="⭐"
          title="No ratings submitted yet"
          description="You have not submitted ratings for any railway food packages. Scan a QR code printed on your meal box to share your feedback."
          action={
            <Link
              href="/scan"
              style={{
                background: "var(--navy)",
                color: "#fff",
                padding: "10px 18px",
                borderRadius: "8px",
                fontSize: "0.875rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Scan Food Package QR
            </Link>
          }
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
          {feedbackList.map((f) => (
            <Card key={f.id} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>
                    {f.food_packages?.package_name || "Food Package"}
                  </h3>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    {f.food_packages?.vendors?.business_name || "Vendor"} • {f.food_packages?.vendors?.station_location || "Station"}
                  </p>
                </div>
                <div style={{ color: "#f59e0b", fontSize: "1.2rem", fontWeight: 700 }}>
                  {"★".repeat(f.rating)}
                  <span style={{ color: "#d1d5db" }}>{"★".repeat(5 - f.rating)}</span>
                </div>
              </div>

              {f.comment && (
                <p style={{ fontSize: "0.85rem", color: "var(--text)", background: "#f8fafc", padding: "10px", borderRadius: "6px" }}>
                  &ldquo;{f.comment}&rdquo;
                </p>
              )}

              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "auto" }}>
                Rated on {formatDate(f.created_at)}
              </div>
            </Card>
          ))}
        </div>
      )}
    </PassengerLayout>
  );
}
