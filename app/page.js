/* app/page.js — RAILGUARD Redesigned Homepage */

import Link from "next/link";
import NavIcon from "@/components/ui/NavIcon";
import HomeFoodCatalog from "@/components/home/HomeFoodCatalog";
import styles from "./page.module.css";

export default function LandingPage() {
  return (
    <div className={styles.page}>
      {/* Top Navigation Bar */}
      <header className={styles.nav}>
        <Link href="/" className={styles.navBrand}>
          <span className={styles.brandMark} aria-hidden="true">RG</span>
          <div>
            <div className={styles.navName}>RAILGUARD</div>
            <div className={styles.navSub}>Indian Railways Food Quality &amp; Audit Platform</div>
          </div>
        </Link>

        <nav className={styles.navLinks} aria-label="Primary navigation">
          <Link href="/scan" className={styles.navLink}>
            Scan QR
          </Link>
          <Link href="/track" className={styles.navLink}>
            Track Complaint
          </Link>
          <Link href="/auth/login" className={styles.navSignIn}>
            Portal Sign In
          </Link>
        </nav>
      </header>

      {/* Hero Section with Indian Passenger Train Photograph */}
      <section className={styles.hero}>
        <div className={styles.heroOverlay} />
        <div className={styles.heroInner}>
          <span className={styles.heroEyebrow}>RAILGUARD · RAILWAY CATERING QUALITY CONTROL</span>
          <h1 className={styles.heroTitle}>Your Journey. Your Voice.</h1>
          <p className={styles.heroSubtitle}>
            Help us improve railway food quality. Scan a food QR code to share feedback or report a problem.
          </p>

          {/* Two Primary Homepage Options */}
          <div className={styles.optionsGrid}>
            {/* Option 1: Scan QR */}
            <div className={styles.optionCard}>
              <div className={styles.optionHeader}>
                <span className={styles.optionBadgeGreen}>Option 1</span>
                <NavIcon name="qr" size={20} />
              </div>
              <h2 className={styles.optionTitle}>
                Scan QR to Give Feedback / Register Complaint
              </h2>
              <p className={styles.optionDesc}>
                Scan the QR code printed on your authorized railway meal package to verify the vendor, submit a rating, or register a food quality complaint.
              </p>
              <Link href="/scan" className={styles.btnGreen}>
                Open QR Scanner →
              </Link>
            </div>

            {/* Option 2: Track Previous Complaint */}
            <div className={styles.optionCard}>
              <div className={styles.optionHeader}>
                <span className={styles.optionBadgeNavy}>Option 2</span>
                <NavIcon name="audit" size={20} />
              </div>
              <h2 className={styles.optionTitle}>
                Track Previous Complaint
              </h2>
              <p className={styles.optionDesc}>
                Already registered a complaint? Enter your unique RailGuard Complaint ID (e.g. RG-2026-A8F42K) to check live status and inspection progress.
              </p>
              <Link href="/track" className={styles.btnNavy}>
                Track Complaint Status →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Food Items & Portal Access */}
      <main className={styles.main}>
        <HomeFoodCatalog />

        <section className={styles.portalsSection}>
          <div className={styles.portalsHeader}>
            <h2 className={styles.portalsTitle}>Role-Based Portals</h2>
            <p className={styles.portalsSub}>
              Dedicated workspaces for passengers, catering vendors, field inspectors, and railway administrators.
            </p>
          </div>

          <div className={styles.portalStrip}>
            <Link href="/auth/login" className={styles.portalTile}>
              <span className={styles.portalRole}>Passenger Portal</span>
              <span className={styles.portalAction}>Sign In / Register →</span>
            </Link>
            <Link href="/vendor/login" className={styles.portalTile}>
              <span className={styles.portalRole}>Vendor Portal</span>
              <span className={styles.portalAction}>Upload Packages &amp; QR →</span>
            </Link>
            <Link href="/inspector/login" className={styles.portalTile}>
              <span className={styles.portalRole}>Inspector Portal</span>
              <span className={styles.portalAction}>Investigate Cases →</span>
            </Link>
            <Link href="/admin/login" className={styles.portalTile}>
              <span className={styles.portalRole}>Admin Portal</span>
              <span className={styles.portalAction}>Manage &amp; Verify →</span>
            </Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        © 2026 RAILGUARD · Passenger Food Feedback &amp; Railway Quality Audit Platform
      </footer>
    </div>
  );
}
