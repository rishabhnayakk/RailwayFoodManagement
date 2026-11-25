/* app/vendor/feedback/page.js
 * Vendor Passenger Feedback & Ratings View
 *
 * Shows ratings and comments submitted for the logged-in vendor's food packages.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import VendorLayout from "@/components/layout/VendorLayout";
import EmptyState from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserProfile } from "@/lib/auth";
import styles from "../vendor.module.css";

export default function VendorFeedbackPage() {
  const router = useRouter();
  const [feedback, setFeedback] = useState([]);
  const [ratingFilter, setRatingFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadFeedback() {
      setLoading(true);
      try {
        const account = await getCurrentUserProfile();
        if (!account?.profile || account.profile.role !== "vendor") {
          router.replace("/auth/login");
          return;
        }

        const supabase = createClient();
        if (!supabase) throw new Error("Supabase is not configured.");

        const { data: vendor, error: vErr } = await supabase
          .from("vendors")
          .select("id")
          .eq("owner_user_id", account.user.id)
          .single();

        if (vErr || !vendor) {
          throw new Error("No vendor profile is linked to your account.");
        }

        const { data: pkgs } = await supabase
          .from("food_packages")
          .select("id, package_name")
          .eq("vendor_id", vendor.id);

        const pkgMap = {};
        const pkgIds = (pkgs || []).map((p) => {
          pkgMap[p.id] = p.package_name;
          return p.id;
        });

        if (pkgIds.length > 0) {
          const { data: fbData, error: fbErr } = await supabase
            .from("feedback")
            .select("id, package_id, rating, comment, created_at")
            .in("package_id", pkgIds)
            .order("created_at", { ascending: false });

          if (fbErr) throw fbErr;
          setFeedback(
            (fbData || []).map((f) => ({
              ...f,
              package_name: pkgMap[f.package_id] || "Food Package",
            }))
          );
        }
      } catch (e) {
        setError(e.message || "Failed to load feedback.");
      } finally {
        setLoading(false);
      }
    }

    loadFeedback();
  }, [router]);

  const filtered = feedback.filter(
    (f) => ratingFilter === "all" || String(f.rating) === ratingFilter
  );

  const avg = feedback.length
    ? (feedback.reduce((sum, f) => sum + (f.rating || 0), 0) / feedback.length).toFixed(1)
    : "—";

  return (
    <VendorLayout title="Passenger Ratings & Feedback">
      {loading ? (
        <div className={styles.loading}>Loading passenger feedback…</div>
      ) : error ? (
        <div className={styles.errorBox} role="alert">
          <strong>⚠️ {error}</strong>
        </div>
      ) : (
        <div className={styles.page}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
              Total Reviews: <strong>{feedback.length}</strong> &nbsp;·&nbsp; Average Score: <strong>{avg} ★</strong>
            </div>
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                background: "#fff",
                fontSize: "0.875rem",
              }}
            >
              <option value="all">All Star Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon="⭐"
              title="No feedback found"
              description="Passenger star ratings and comments submitted after scanning your package QR codes will appear here."
            />
          ) : (
            <div className={styles.reviewList}>
              {filtered.map((f) => (
                <div key={f.id} className={styles.reviewCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span className={styles.bold} style={{ fontSize: "0.9rem" }}>
                      📦 {f.package_name}
                    </span>
                    <div className={styles.reviewStars}>
                      {"★".repeat(f.rating)}{"☆".repeat(5 - f.rating)}
                    </div>
                  </div>
                  <p className={styles.reviewComment}>
                    {f.comment || "Rating submitted without written comment."}
                  </p>
                  <span className={styles.reviewDate}>
                    {new Date(f.created_at).toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </VendorLayout>
  );
}
