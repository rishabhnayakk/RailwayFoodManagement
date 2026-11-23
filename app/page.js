/* app/page.js — Landing page
 *
 * WHAT IT DOES:
 *   The first page visitors see. Shows three entry portals:
 *   Passenger (scan QR), Admin (dashboard), Inspector.
 *   No database calls here — it is a pure static page.
 *
 * HOW TO EXPLAIN:
 *   "This is a Server Component — no 'use client' needed.
 *    It has no interactivity so React renders it once on the server.
 *    Links go to the three portals."
 */

import Link from "next/link";
import styles from "./page.module.css";

export default function LandingPage() {
  return (
    <div className={styles.page}>

      {/* ── Navbar ── */}
      <nav className={styles.nav}>
        <Link href="/" className={styles.navBrand}>
          <div className={styles.navLogo}>🛡️</div>
          <div>
            <div className={styles.navName}>RailGuard</div>
            <div className={styles.navSub}>Ministry of Railways</div>
          </div>
        </Link>
        <div className={styles.navLinks}>
          <Link href="/admin" className={styles.navLink}>Admin</Link>
          <Link href="/inspector" className={styles.navLink}>Inspector</Link>
          <Link href="/scan" className={styles.navCta}>Scan QR</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroBadge}>
          🚂 Official Railway Quality Monitoring System
        </div>
        <h1 className={styles.heroTitle}>
          Ensuring Railway Food Safety<br />
          <span className={styles.heroAccent}>Through Smart Audits</span>
        </h1>
        <p className={styles.heroDesc}>
          Passengers scan QR codes on food packaging to submit real-time feedback.
          Quality teams investigate complaints and monitor vendor performance.
        </p>
        <div className={styles.heroBtns}>
          <Link href="/scan" className={styles.btnGreen}>
            📱 Scan QR Code
          </Link>
          <Link href="/admin" className={styles.btnWhite}>
            🛡️ Admin Dashboard
          </Link>
        </div>
      </section>

      {/* ── Portals ── */}
      <section className={styles.portals}>
        <h2 className={styles.sectionTitle}>Choose Your Portal</h2>
        <p className={styles.sectionDesc}>
          Select your role to access the right tools.
        </p>
        <div className={styles.portalGrid}>

          <Link href="/scan" className={styles.portalCard}>
            <div className={styles.portalIcon}>📱</div>
            <div className={styles.portalTitle}>Passenger Portal</div>
            <div className={styles.portalDesc}>
              Scan the QR code on your food packaging. View food details,
              rate your experience, report hygiene issues, and upload images.
              No account needed — feedback is anonymous.
            </div>
            <div className={styles.portalLink}>Scan & Submit Feedback →</div>
          </Link>

          <Link href="/admin" className={styles.portalCard}>
            <div className={styles.portalIcon}>🛡️</div>
            <div className={styles.portalTitle}>Admin Dashboard</div>
            <div className={styles.portalDesc}>
              Manage vendors, review complaints, generate QR codes, assign
              inspectors, and monitor railway food quality through a
              centralized dashboard.
            </div>
            <div className={styles.portalLink}>Go to Admin Panel →</div>
          </Link>

          <Link href="/inspector" className={styles.portalCard}>
            <div className={styles.portalIcon}>🔍</div>
            <div className={styles.portalTitle}>Inspector Portal</div>
            <div className={styles.portalDesc}>
              View assigned complaint cases, review passenger images,
              record field inspection findings, and submit resolution
              remarks.
            </div>
            <div className={styles.portalLink}>Access Inspector Portal →</div>
          </Link>

        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        © 2025 RailGuard – Ministry of Railways, Government of India.
        Academic project.
      </footer>
    </div>
  );
}
