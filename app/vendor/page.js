/* app/vendor/page.js
 * Vendor (Catering Partner) Dashboard
 *
 * Displays real-time statistics and operational data for the logged-in vendor.
 * Uses VendorLayout for consistent shell navigation.
 * Data is fetched from Supabase and scoped strictly to the authenticated vendor.
 * No hardcoded or mock data.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import VendorLayout from "@/components/layout/VendorLayout";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserProfile } from "@/lib/auth";
import styles from "./vendor.module.css";

export default function VendorDashboard() {
  const router = useRouter();

  const [vendor,   setVendor]   = useState(null);
  const [packages, setPackages] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const account = await getCurrentUserProfile();
        if (!account?.profile) {
          router.replace("/auth/login");
          return;
        }
        if (account.profile.role !== "vendor") {
          router.replace("/auth/login");
          return;
        }

        const supabase = createClient();
        if (!supabase) throw new Error("Supabase is not configured. Contact admin.");

        // 1. Fetch vendor record linked to this user
        const { data: vendorData, error: vErr } = await supabase
          .from("vendors")
          .select("*")
          .eq("owner_user_id", account.user.id)
          .single();

        if (vErr || !vendorData) {
          throw new Error(
            "No vendor profile is linked to your account. Please contact the Admin."
          );
        }
        setVendor(vendorData);

        // 2. Fetch this vendor's food packages
        const { data: pkgData, error: pkgErr } = await supabase
          .from("food_packages")
          .select("id, package_name, category, price, status, created_at")
          .eq("vendor_id", vendorData.id)
          .order("created_at", { ascending: false });

        if (pkgErr) throw pkgErr;
        const pkgs = pkgData || [];
        setPackages(pkgs);

        const pkgIds = pkgs.map((p) => p.id);

        // 3. Fetch feedback for this vendor's packages + non-PII complaints via API
        if (pkgIds.length > 0) {
          const [fbRes, cmpRes] = await Promise.all([
            supabase
              .from("feedback")
              .select("id, package_id, rating, comment, created_at")
              .in("package_id", pkgIds)
              .order("created_at", { ascending: false })
              .limit(10),
            fetch("/api/vendor/complaints").then((r) => (r.ok ? r.json() : { complaints: [] })),
          ]);

          if (!fbRes.error) setFeedback(fbRes.data || []);
          setComplaints(cmpRes.complaints || []);
        }
      } catch (e) {
        setError(e.message || "Unable to load dashboard.");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [router]);

  // Computed stats
  const activePkgs   = packages.filter((p) => p.status === "active").length;
  const avgRating    = feedback.length
    ? (feedback.reduce((sum, f) => sum + (f.rating || 0), 0) / feedback.length).toFixed(1)
    : null;
  const openComplaints = complaints.filter(
    (c) => c.status !== "resolved"
  ).length;

  // ── SEVERITY BADGE ─────────────────────────────────────────────────────
  function SeverityBadge({ severity }) {
    const map = {
      low:      { bg: "#dcfce7", color: "#166534", label: "Low"      },
      medium:   { bg: "#fef9c3", color: "#854d0e", label: "Medium"   },
      high:     { bg: "#fee2e2", color: "#991b1b", label: "High"     },
      critical: { bg: "#fce7f3", color: "#9d174d", label: "Critical" },
    };
    const s = map[severity] || { bg: "#f1f5f9", color: "#475569", label: severity || "—" };
    return (
      <span style={{
        background: s.bg, color: s.color,
        padding: "2px 8px", borderRadius: "999px",
        fontSize: "0.72rem", fontWeight: 700,
      }}>
        {s.label}
      </span>
    );
  }

  function StatusBadge({ status }) {
    const map = {
      pending_review:    { bg: "#fef9c3", color: "#854d0e" },
      assigned:          { bg: "#dbeafe", color: "#1d4ed8" },
      in_progress:       { bg: "#ede9fe", color: "#6d28d9" },
      report_submitted:  { bg: "#e0f2fe", color: "#0369a1" },
      resolved:          { bg: "#dcfce7", color: "#166534" },
      reopened:          { bg: "#fee2e2", color: "#991b1b" },
    };
    const s = map[status] || { bg: "#f1f5f9", color: "#475569" };
    const label = status?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "—";
    return (
      <span style={{
        background: s.bg, color: s.color,
        padding: "2px 8px", borderRadius: "999px",
        fontSize: "0.72rem", fontWeight: 700,
      }}>
        {label}
      </span>
    );
  }

  // ── RENDER ──────────────────────────────────────────────────────────────
  return (
    <VendorLayout title="Dashboard">
      {loading ? (
        <div className={styles.loading}>Loading your dashboard…</div>
      ) : error ? (
        <div className={styles.errorBox} role="alert">
          <strong>⚠️ {error}</strong>
        </div>
      ) : (
        <div className={styles.page}>

          {/* ── Vendor Identity Card ── */}
          <section className={styles.identityCard}>
            <div className={styles.identityIcon}>🏪</div>
            <div className={styles.identityInfo}>
              <h2 className={styles.bizName}>{vendor.business_name}</h2>
              <p className={styles.bizMeta}>
                📍 {vendor.station_location || "Station not set"}
                &nbsp;·&nbsp;
                🪪 Licence: {vendor.license_number || "—"}
                &nbsp;·&nbsp;
                <span
                  className={styles.statusDot}
                  style={{ color: vendor.status === "active" ? "#166534" : "#991b1b" }}
                >
                  ● {vendor.status === "active" ? "Active" : "Inactive"}
                </span>
              </p>
              {vendor.contact_name && (
                <p className={styles.bizMeta}>👤 {vendor.contact_name}</p>
              )}
            </div>
          </section>

          {/* ── KPI Cards ── */}
          <div className={styles.kpiGrid}>
            {[
              { icon: "📦", label: "Total Packages",  value: packages.length    },
              { icon: "✅", label: "Active Packages",  value: activePkgs         },
              { icon: "💬", label: "Total Reviews",    value: feedback.length    },
              { icon: "⭐", label: "Average Rating",   value: avgRating ?? "—"  },
              { icon: "⚠️", label: "Open Complaints",  value: openComplaints     },
            ].map(({ icon, label, value }) => (
              <div key={label} className={styles.kpiCard}>
                <div className={styles.kpiIcon}>{icon}</div>
                <div>
                  <div className={styles.kpiValue}>{value}</div>
                  <div className={styles.kpiLabel}>{label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Recent Food Packages ── */}
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h3 className={styles.sectionTitle}>📦 Recent Food Packages</h3>
              <Link href="/vendor/packages" className={styles.viewAll}>View all →</Link>
            </div>
            {packages.length === 0 ? (
              <p className={styles.empty}>
                No food packages assigned yet. Contact RailGuard Admin to add packages.
              </p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Package Name</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Status</th>
                      <th>Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packages.slice(0, 5).map((pkg) => (
                      <tr key={pkg.id}>
                        <td className={styles.bold}>{pkg.package_name}</td>
                        <td>{pkg.category || "—"}</td>
                        <td>{pkg.price != null ? `₹${pkg.price}` : "—"}</td>
                        <td>
                          <span className={
                            pkg.status === "active" ? styles.badgeGreen : styles.badgeRed
                          }>
                            {pkg.status}
                          </span>
                        </td>
                        <td>{new Date(pkg.created_at).toLocaleDateString("en-IN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── Recent Feedback ── */}
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h3 className={styles.sectionTitle}>⭐ Recent Passenger Feedback</h3>
              <Link href="/vendor/feedback" className={styles.viewAll}>View all →</Link>
            </div>
            {feedback.length === 0 ? (
              <p className={styles.empty}>No passenger feedback yet.</p>
            ) : (
              <div className={styles.reviewList}>
                {feedback.slice(0, 5).map((f) => (
                  <div key={f.id} className={styles.reviewCard}>
                    <div className={styles.reviewStars}>
                      {"★".repeat(f.rating)}{"☆".repeat(5 - f.rating)}
                    </div>
                    <p className={styles.reviewComment}>{f.comment || "Rating only — no comment."}</p>
                    <span className={styles.reviewDate}>
                      {new Date(f.created_at).toLocaleDateString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Recent Complaints ── */}
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h3 className={styles.sectionTitle}>⚠️ Recent Complaints</h3>
              <Link href="/vendor/complaints" className={styles.viewAll}>View all →</Link>
            </div>
            {complaints.length === 0 ? (
              <p className={styles.empty}>No complaints filed against your packages. Keep it up!</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Issue Type</th>
                      <th>Severity</th>
                      <th>Status</th>
                      <th>Filed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {complaints.slice(0, 5).map((c) => (
                      <tr key={c.id}>
                        <td className={styles.bold}>
                          {c.issue_type?.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase()) || "—"}
                        </td>
                        <td><SeverityBadge severity={c.severity} /></td>
                        <td><StatusBadge status={c.status} /></td>
                        <td>{new Date(c.created_at).toLocaleDateString("en-IN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p className={styles.disclaimer}>
            Vendors can view only their own packages, feedback, and complaints.
            Complaint assignment, inspection reports, and complaint closure are managed by the RailGuard Admin.
          </p>
        </div>
      )}
    </VendorLayout>
  );
}
