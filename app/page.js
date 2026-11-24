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
            Passenger Sign In
          </Link>
          <Link href="/inspector/login" className={styles.navLink}>
            Inspector
          </Link>
          <Link href="/admin/login" className={styles.navLink}>
            Admin
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
        <h2 className={styles.sectionTitle}>Role-Based Application Portals</h2>
        <p className={styles.sectionDesc}>
          RailGuard separates passenger feedback, field investigations, and administrative quality auditing.
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
            <Link href="/inspector/login" className={styles.portalLink}>
              Inspector Sign In →
            </Link>
          </div>

          {/* Admin Portal */}
          <div className={styles.portalCard}>
            <div className={styles.portalIcon}>🛡️</div>
            <div className={styles.portalTitle}>Railway Department Admin</div>
            <div className={styles.portalDesc}>
              Oversee catering contractors, register food packages, generate printable QR codes, assign cases to inspectors, review findings, and monitor quality trends.
            </div>
            <Link href="/admin/login" className={styles.portalLink}>
              Admin Sign In →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Architecture Note on Vendors ── */}
      <section style={{ maxWidth: "1100px", margin: "0 auto 60px", padding: "0 32px" }}>
        <div style={{ background: "#f8fafc", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "8px", color: "var(--navy)" }}>
            🏢 Vendor Management Architecture Note
          </h3>
          <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
            Food vendors and catering contractors (e.g. pantry car operators, base kitchens) are supplier entities managed centrally by the Railway Administration. Vendors do not have application user accounts; all vendor licensing, food package registrations, and quality metrics are audited directly by Railway Admins.
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        © 2026 RailGuard – Ministry of Railways, Government of India. Quality Audit Platform.
      </footer>
    </div>
  );
}
