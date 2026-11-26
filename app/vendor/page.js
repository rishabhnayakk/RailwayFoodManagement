/* app/vendor/page.js — Vendor Catalog & QR Operations Dashboard */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import VendorLayout from "@/components/layout/VendorLayout";
import { ApprovalBadge, SeverityBadge, StatusBadge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserProfile } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import styles from "./vendor.module.css";

export default function VendorDashboard() {
  const router = useRouter();

  const [vendor, setVendor] = useState(null);
  const [packages, setPackages] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const account = await getCurrentUserProfile();
        if (!account?.profile || account.profile.role !== "vendor") {
          router.replace("/auth/login");
          return;
        }

        const supabase = createClient();
        if (!supabase) throw new Error("Supabase is not configured. Contact admin.");

        const { data: vendorData, error: vErr } = await supabase
          .from("vendors")
          .select("*")
          .eq("owner_user_id", account.user.id)
          .single();

        if (vErr || !vendorData) {
          throw new Error("No vendor profile is linked to your account. Please contact the Admin.");
        }
        setVendor(vendorData);

        const { data: pkgData, error: pkgErr } = await supabase
          .from("food_packages")
          .select("id, package_name, category, price, status, approval_status, created_at, qr_codes(id, qr_token, is_active)")
          .eq("vendor_id", vendorData.id)
          .order("created_at", { ascending: false });

        if (pkgErr) throw pkgErr;
        const pkgs = pkgData || [];
        setPackages(pkgs);

        const pkgIds = pkgs.map((p) => p.id);
        if (pkgIds.length > 0) {
          const [fbRes, cmpRes] = await Promise.all([
            supabase
              .from("feedback")
              .select("id, package_id, rating, comment, created_at")
              .in("package_id", pkgIds)
              .order("created_at", { ascending: false })
              .limit(6),
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

  const approvedPkgs = packages.filter((p) => p.approval_status === "approved").length;
  const pendingPkgs = packages.filter((p) => (p.approval_status || "pending") === "pending").length;
  const avgRating = feedback.length
    ? (feedback.reduce((sum, f) => sum + (f.rating || 0), 0) / feedback.length).toFixed(1)
    : null;
  const openComplaints = complaints.filter((c) => c.status !== "resolved").length;

  return (
    <VendorLayout title="Vendor Workspace">
      {loading ? (
        <div className={styles.loading}>Loading vendor workspace…</div>
      ) : error ? (
        <div className={styles.errorBox} role="alert">
          <strong>{error}</strong>
        </div>
      ) : (
        <div className={styles.page}>
          {vendor.status === "suspended" && (
            <div className={styles.errorBox} role="alert">
              <strong>Account Suspended:</strong> Your catering account is suspended by Railway Administration. Package uploads and public QR scanning are disabled until reactivated.
            </div>
          )}

          {/* Vendor Header Strip */}
          <section className={styles.identityCard}>
            <div className={styles.identityInfo}>
              <h2 className={styles.bizName}>{vendor.business_name}</h2>
              <p className={styles.bizMeta}>
                Station: {vendor.station_location || "Not set"} · Licence: {vendor.license_number || "—"} · Status:{" "}
                <span
                  className={styles.statusDot}
                  style={{ color: vendor.status === "active" ? "#15803d" : "#b91c1c" }}
                >
                  {vendor.status === "active" ? "Active" : "Suspended"}
                </span>
              </p>
            </div>
            <Link
              href="/vendor/packages"
              style={{
                background: "var(--navy)",
                color: "#fff",
                padding: "8px 14px",
                borderRadius: "6px",
                fontSize: "0.84rem",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              + Upload Food Package
            </Link>
          </section>

          {/* Compact Summary Strip */}
          <section className={styles.summaryStrip}>
            {[
              { label: "Total Packages", value: packages.length },
              { label: "Approved", value: approvedPkgs },
              { label: "Pending Approval", value: pendingPkgs },
              { label: "Reviews", value: feedback.length },
              { label: "Avg Rating", value: avgRating ? `${avgRating} / 5` : "—" },
              { label: "Open Complaints", value: openComplaints },
            ].map(({ label, value }) => (
              <div key={label} className={styles.summaryCell}>
                <div className={styles.kpiValue}>{value}</div>
                <div className={styles.kpiLabel}>{label}</div>
              </div>
            ))}
          </section>

          {/* Primary Table: Food Packages & QR Status */}
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h3 className={styles.sectionTitle}>Uploaded Food Packages &amp; QR Status</h3>
              <Link href="/vendor/packages" className={styles.viewAll}>Manage packages &amp; QR →</Link>
            </div>
            {packages.length === 0 ? (
              <p className={styles.empty}>
                No food packages uploaded yet.{" "}
                <Link href="/vendor/packages" style={{ color: "var(--navy)", fontWeight: 600, textDecoration: "underline" }}>
                  Upload your first package and generate a QR code
                </Link>
              </p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Food Package</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Approval</th>
                      <th>QR Code</th>
                      <th>Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packages.slice(0, 6).map((pkg) => {
                      const qr = Array.isArray(pkg.qr_codes) ? pkg.qr_codes[0] : pkg.qr_codes;
                      return (
                        <tr key={pkg.id}>
                          <td className={styles.bold}>{pkg.package_name}</td>
                          <td>{pkg.category || "—"}</td>
                          <td>{pkg.price != null ? `₹${pkg.price}` : "—"}</td>
                          <td><ApprovalBadge status={pkg.approval_status || "pending"} /></td>
                          <td>
                            {qr?.qr_token ? (
                              <span style={{ fontSize: "0.78rem", color: "#15803d", fontWeight: 600 }}>Generated</span>
                            ) : (
                              <span style={{ fontSize: "0.78rem", color: "#b45309" }}>Pending</span>
                            )}
                          </td>
                          <td>{formatDate(pkg.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Two-Column Split: Package Complaints & Customer Ratings */}
          <div className={styles.twoCol}>
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <h3 className={styles.sectionTitle}>Complaints on Your Packages</h3>
                <Link href="/vendor/complaints" className={styles.viewAll}>View all →</Link>
              </div>
              {complaints.length === 0 ? (
                <p className={styles.empty}>No complaints filed against your food packages.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Package</th>
                        <th>Issue</th>
                        <th>Severity</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {complaints.slice(0, 5).map((c) => (
                        <tr key={c.id}>
                          <td className={styles.bold}>{c.food_packages?.package_name || "Package"}</td>
                          <td>{c.issue_type?.replace(/_/g, " ") || "—"}</td>
                          <td><SeverityBadge severity={c.severity} /></td>
                          <td><StatusBadge status={c.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <h3 className={styles.sectionTitle}>Recent Customer Feedback</h3>
                <Link href="/vendor/feedback" className={styles.viewAll}>View all →</Link>
              </div>
              {feedback.length === 0 ? (
                <p className={styles.empty}>No customer ratings recorded yet.</p>
              ) : (
                <div className={styles.reviewList}>
                  {feedback.slice(0, 4).map((f) => (
                    <div key={f.id} className={styles.reviewCard}>
                      <div className={styles.reviewStars}>Rating: {f.rating} / 5</div>
                      <p className={styles.reviewComment}>{f.comment || "No written comment."}</p>
                      <span className={styles.reviewDate}>{formatDate(f.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <p className={styles.disclaimer}>
            Access is scoped strictly to your catering business. Passenger contact details and internal inspection records are hidden.
          </p>
        </div>
      )}
    </VendorLayout>
  );
}
