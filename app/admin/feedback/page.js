/* app/admin/feedback/page.js
 * Admin Passenger Feedback Management Portal
 *
 * Allows Railway Administrators to view all submitted passenger feedback
 * and filter by vendor, food package, star rating, and date.
 */

"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonLine } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import styles from "../complaints/complaints.module.css";

export default function AdminFeedbackPage() {
  const [feedback, setFeedback] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  const [vendorFilter, setVendorFilter] = useState("all");
  const [packageFilter, setPackageFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");

  useEffect(() => {
    async function loadFeedbackData() {
      const supabase = createClient();
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        const [fbRes, vRes, pRes] = await Promise.all([
          supabase
            .from("feedback")
            .select(`
              id,
              package_id,
              passenger_name,
              rating,
              comment,
              created_at,
              food_packages (
                id,
                package_name,
                vendor_id,
                vendors (
                  id,
                  business_name,
                  station_location
                )
              )
            `)
            .order("created_at", { ascending: false }),
          supabase.from("vendors").select("id, business_name").order("business_name"),
          supabase.from("food_packages").select("id, package_name").order("package_name"),
        ]);

        if (!fbRes.error && fbRes.data) setFeedback(fbRes.data);
        if (!vRes.error && vRes.data) setVendors(vRes.data);
        if (!pRes.error && pRes.data) setPackages(pRes.data);
      } catch (err) {
        console.error("Error loading feedback:", err);
      } finally {
        setLoading(false);
      }
    }

    loadFeedbackData();
  }, []);

  const filtered = feedback.filter((f) => {
    const matchVendor =
      vendorFilter === "all" || f.food_packages?.vendors?.id === vendorFilter;
    const matchPkg =
      packageFilter === "all" || f.package_id === packageFilter;
    const matchRating =
      ratingFilter === "all" || String(f.rating) === ratingFilter;
    const matchDate =
      !dateFilter || f.created_at?.slice(0, 10) === dateFilter;

    return matchVendor && matchPkg && matchRating && matchDate;
  });

  const avgRating = filtered.length
    ? (filtered.reduce((sum, f) => sum + (f.rating || 0), 0) / filtered.length).toFixed(1)
    : "—";

  return (
    <AdminLayout title="Passenger Feedback Management">
      <div className={styles.container}>
        {/* Filters */}
        <div className={styles.filtersRow}>
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className={styles.select}
          >
            <option value="all">All Vendors</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.business_name}
              </option>
            ))}
          </select>

          <select
            value={packageFilter}
            onChange={(e) => setPackageFilter(e.target.value)}
            className={styles.select}
          >
            <option value="all">All Food Packages</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.package_name}
              </option>
            ))}
          </select>

          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
            className={styles.select}
          >
            <option value="all">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>

          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className={styles.select}
            aria-label="Filter by date"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              Passenger Reviews ({filtered.length}) · Avg: {avgRating} ★
            </CardTitle>
          </CardHeader>
          <CardBody style={{ padding: 0 }}>
            {loading ? (
              <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
                {[1, 2, 3, 4].map((i) => (
                  <SkeletonLine key={i} height={20} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon="⭐"
                title="No passenger feedback found"
                description="No reviews match your current filters yet."
              />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Food Package</th>
                      <th>Vendor</th>
                      <th>Passenger</th>
                      <th>Overall Rating</th>
                      <th>Comments</th>
                      <th>Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((f) => (
                      <tr key={f.id}>
                        <td style={{ fontWeight: 600 }}>
                          {f.food_packages?.package_name || "Food Package"}
                        </td>
                        <td style={{ color: "var(--text-muted)" }}>
                          {f.food_packages?.vendors?.business_name || "—"}
                        </td>
                        <td>{f.passenger_name || "Anonymous"}</td>
                        <td style={{ color: "#d97706", fontWeight: 700, whiteSpace: "nowrap" }}>
                          {"★".repeat(f.rating)}{"☆".repeat(5 - f.rating)} ({f.rating}/5)
                        </td>
                        <td style={{ maxWidth: "320px", fontSize: "0.84rem", color: "var(--text-muted)" }}>
                          {f.comment || "—"}
                        </td>
                        <td style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                          {formatDate(f.created_at)}
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
