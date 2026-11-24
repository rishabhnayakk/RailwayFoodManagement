/* app/page.js — Landing page
 *
 * Central Portal for RailGuard:
 * - Passengers: Register, Sign In, Scan QR, Submit Feedback & Complaints, Track Status
 * - Inspectors: Sign In, View Assigned Cases, Submit Findings & Evidence
 * - Railway Admin: Sign In, Manage Vendors, Generate QR Codes, Assign Cases, Analytics
 */

import Link from "next/link";
import styles from "./page.module.css";

export default function LandingPage() {
  return (
    <div className={styles.page}>
      {/* ── Top Navbar ── */}
      <nav className={styles.nav}>
        <Link href="/" className={styles.navBrand}>
          <div className={styles.navLogo}>🛡️</div>
          <div>
            <div className={styles.navName}>RailGuard</div>
            <div className={styles.navSub}>Ministry of Railways • Quality Control</div>
          </div>
        </Link>
        <div className={styles.navLinks}>
          <Link href="/auth/login" className={styles.navLink}>
            Sign In
          </Link>
          <Link href="/scan" className={styles.navCta}>
            📱 Scan Food QR
          </Link>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className={styles.hero}>
        <div className={styles.heroBadge}>
          🚂 Official Railway Food Quality Audit & Passenger Feedback Platform
        </div>
        <h1 className={styles.heroTitle}>
          Ensuring Railway Food Safety<br />
          <span className={styles.heroAccent}>Through Smart Audits</span>
        </h1>
        <p className={styles.heroDesc}>
          Scan authorized QR codes printed on railway meal boxes. View vendor credentials, submit star ratings, report hygiene violations with photo evidence, and track investigation reports in real-time.
        </p>
        <div className={styles.heroBtns}>
          <Link href="/scan" className={styles.btnGreen}>
            📱 Scan Package QR Code
          </Link>
          <Link href="/auth/register" className={styles.btnWhite}>
            👤 Register as Passenger
          </Link>
        </div>
      </section>

      {/* ── Three Dedicated Role Portals ── */}
      <section className={styles.portals}>
        <h2 className={styles.sectionTitle}>One Secure Login for Every Role</h2>
        <p className={styles.sectionDesc}>
          Passengers, Railway Admins, Food Inspectors, and Catering Vendors all use the same secure sign-in page. Your account role determines which dashboard opens.
        </p>
        <div className={styles.portalGrid}>
          {/* Passenger Portal */}
          <div className={styles.portalCard}>
            <div className={styles.portalIcon}>👤</div>
            <div className={styles.portalTitle}>Passenger Portal</div>
            <div className={styles.portalDesc}>
              Register or sign in to submit verified food ratings, file hygiene complaints with photographic evidence, and track your complaint through the 6-stage investigation lifecycle.
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <Link href="/auth/login" className={styles.portalLink}>
                Sign In →
              </Link>
              <Link href="/auth/register" className={styles.portalLink} style={{ color: "var(--text-muted)" }}>
                Register
              </Link>
            </div>
          </div>

          {/* Inspector Portal */}
          <div className={styles.portalCard}>
            <div className={styles.portalIcon}>🔍</div>
            <div className={styles.portalTitle}>Quality Inspector Portal</div>
            <div className={styles.portalDesc}>
              Designated railway food safety inspectors examine assigned complaints, inspect pantry cars and catering units, record observations, and file official inspection reports.
            </div>
            <Link href="/auth/login" className={styles.portalLink}>
              Sign In →
            </Link>
          </div>

          {/* Admin Portal */}
          <div className={styles.portalCard}>
            <div className={styles.portalIcon}>🛡️</div>
            <div className={styles.portalTitle}>Railway Department Admin</div>
            <div className={styles.portalDesc}>
              Oversee catering contractors, register food packages, generate printable QR codes, assign cases to inspectors, review findings, and monitor quality trends.
            </div>
            <Link href="/auth/login" className={styles.portalLink}>
              Sign In →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        © 2026 RailGuard – Ministry of Railways, Government of India. Quality Audit Platform.
      </footer>
    </div>
  );
}
