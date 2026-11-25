/* components/home/HomeFoodCatalog.jsx
 * Displays all real vendor-submitted food items from Supabase on the homepage.
 * Shows unique item code + QR access for approved items, and realistic empty state when none exist.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { FOOD_CATEGORIES } from "@/lib/constants";
import { truncate } from "@/lib/utils";
import styles from "./HomeFoodCatalog.module.css";

export default function HomeFoodCatalog() {
  const [packages, setPackages] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [qrModalItem, setQrModalItem] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    let active = true;
    async function loadCatalog() {
      try {
        const res = await fetch("/api/public/packages");
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Unable to load food items.");
        }
        if (active) {
          setConfigured(data.configured !== false);
          setPackages(data.packages || []);
        }
      } catch (err) {
        if (active) setError(err.message || "Failed to load food catalog.");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadCatalog();
    return () => {
      active = false;
    };
  }, []);

  async function handleOpenQr(pkg) {
    if (!pkg.qr_token) return;
    setQrModalItem(pkg);
    setQrDataUrl("");
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const url = await QRCode.toDataURL(`${origin}/scan/${pkg.qr_token}`, {
        width: 260,
        margin: 2,
        color: { dark: "#0f2a52", light: "#ffffff" },
      });
      setQrDataUrl(url);
    } catch {
      setQrDataUrl("");
    }
  }

  const filtered = packages.filter((pkg) => {
    const matchesCat =
      categoryFilter === "all" ||
      (pkg.category || "").toLowerCase() === categoryFilter.toLowerCase();
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      pkg.package_name?.toLowerCase().includes(term) ||
      pkg.vendor_name?.toLowerCase().includes(term) ||
      pkg.station_location?.toLowerCase().includes(term) ||
      pkg.package_code?.toLowerCase().includes(term);
    return matchesCat && matchesSearch;
  });

  return (
    <section className={styles.section} aria-labelledby="food-catalog-heading">
      <div className={styles.headerRow}>
        <div>
          <h2 id="food-catalog-heading" className={styles.title}>
            Registered Railway Food Items ({filtered.length})
          </h2>
          <p className={styles.subtitle}>
            Every food item is assigned a unique item code and QR token when submitted by an authorized vendor.
          </p>
        </div>

        <div className={styles.filters}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search food, vendor, station, or ID..."
            className={styles.searchInput}
            aria-label="Search food items"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={styles.select}
            aria-label="Filter by food category"
          >
            <option value="all">All Categories</option>
            {FOOD_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className={styles.stateBox}>Loading railway food catalog…</div>
      ) : error ? (
        <div className={styles.errorBox}>{error}</div>
      ) : !configured ? (
        <div className={styles.stateBox}>
          Database is not connected yet. Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code>.env.local</code>, run <code>supabase/schema.sql</code> and <code>supabase/seed_2_food_items.sql</code> in Supabase SQL Editor, then restart the server to display food items here.
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.stateBox}>
          {packages.length === 0
            ? "No food items have been submitted by vendors yet. Food packages uploaded in the Vendor Portal will appear here automatically."
            : "No food items match your current search or category filter."}
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((pkg) => {
            const isApproved = pkg.approval_status === "approved" && Boolean(pkg.qr_token);
            return (
              <article key={pkg.id} className={styles.card}>
                {pkg.image_url && (
                  <img
                    src={pkg.image_url}
                    alt={pkg.package_name}
                    className={styles.foodImg}
                  />
                )}
                <div className={styles.cardBody}>
                  <div className={styles.topRow}>
                    <span className={styles.codeBadge}>{pkg.package_code}</span>
                    <span
                      className={
                        isApproved ? styles.approvedBadge : styles.pendingBadge
                      }
                    >
                      {isApproved ? "Approved · QR Active" : "Pending Approval"}
                    </span>
                  </div>

                  <div className={styles.titleRow}>
                    <h3 className={styles.foodName}>{pkg.package_name}</h3>
                    <span className={styles.price}>
                      {pkg.price != null ? `₹${Number(pkg.price).toFixed(2)}` : "—"}
                    </span>
                  </div>

                  <p className={styles.meta}>
                    {pkg.category || "Meals"} · {pkg.vendor_name}
                    {pkg.station_location ? ` (${pkg.station_location})` : ""}
                  </p>

                  {pkg.description && (
                    <p className={styles.desc}>{truncate(pkg.description, 110)}</p>
                  )}

                  {pkg.train_info && (
                    <p className={styles.trainLine}>Train: {pkg.train_info}</p>
                  )}

                  <div className={styles.cardActions}>
                    {isApproved ? (
                      <>
                        <Link
                          href={`/scan/${encodeURIComponent(pkg.qr_token)}`}
                          className={styles.scanBtn}
                        >
                          Rate / Report →
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleOpenQr(pkg)}
                          className={styles.qrBtn}
                        >
                          View QR
                        </button>
                      </>
                    ) : (
                      <span className={styles.pendingNote}>
                        QR generated — awaiting Admin approval before scanning
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {qrModalItem && (
        <div className={styles.modalOverlay} onClick={() => setQrModalItem(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>{qrModalItem.package_name}</h3>
            <p className={styles.modalCode}>Item Code: {qrModalItem.package_code}</p>
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR for ${qrModalItem.package_name}`}
                className={styles.modalQr}
              />
            ) : (
              <p style={{ fontSize: "0.84rem", color: "#4b5563", margin: "20px 0" }}>
                Generating QR…
              </p>
            )}
            <div className={styles.modalActions}>
              <Link
                href={`/scan/${encodeURIComponent(qrModalItem.qr_token)}`}
                className={styles.scanBtn}
              >
                Open Feedback Form →
              </Link>
              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download={`${qrModalItem.package_code || "railguard-food"}-qr.png`}
                  className={styles.qrBtn}
                >
                  Download PNG
                </a>
              )}
              <button
                type="button"
                onClick={() => setQrModalItem(null)}
                className={styles.qrBtn}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
