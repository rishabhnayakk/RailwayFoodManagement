/* app/page.js — RailGuard Landing Page */

import Link from "next/link";
import NavIcon from "@/components/ui/NavIcon";
import styles from "./page.module.css";

const PORTAL_DIRECTORY = [
  {
    role: "Passenger",
    purpose: "Scan meal QR codes, verify vendor details, submit food ratings/feedback, register complaints, and track resolution.",
    primaryHref: "/auth/login",
    primaryLabel: "Passenger Sign In",
    secondaryHref: "/auth/register",
    secondaryLabel: "Register",
  },
  {
    role: "Catering Vendor",
    purpose: "Upload food packages with ingredients and photos, generate unique packaging QR codes, download PNG labels, and review feedback.",
    primaryHref: "/vendor/login",
    primaryLabel: "Vendor Sign In",
  },
  {
    role: "Quality Inspector",
    purpose: "Investigate complaints assigned by Administration, record on-site findings, upload evidence photos, and file formal audit reports.",
    primaryHref: "/inspector/login",
    primaryLabel: "Inspector Sign In",
  },
  {
    role: "Railway Department Admin",
    purpose: "Provision and suspend Vendor and Inspector accounts, approve food packages, assign complaints, and verify final resolution.",
    primaryHref: "/admin/login",
    primaryLabel: "Admin Sign In",
  },
];

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <Link href="/" className={styles.navBrand}>
          <span className={styles.navName}>RailGuard</span>
          <span className={styles.navSub}>Railway Food Quality & Audit Platform</span>
        </Link>
        <div className={styles.navLinks}>
          <Link href="/auth/login" className={styles.navLink}>
            Sign In
          </Link>
          <Link href="/scan" className={styles.navCta}>
            <NavIcon name="qr" size={15} />
            <span>Scan Food QR</span>
          </Link>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.introGrid}>
          <div className={styles.introPrimary}>
            <p className={styles.eyebrow}>Ministry of Railways · Catering Quality Monitoring</p>
            <h1 className={styles.title}>
              Railway Food Package Verification, Feedback &amp; Audit Tracking
            </h1>
            <p className={styles.desc}>
              RailGuard connects passengers, catering vendors, field quality inspectors, and railway administrators on a single auditable workflow. Scan any authorized meal package QR code to verify catering credentials or lodge a hygiene complaint.
            </p>
            <div className={styles.actions}>
              <Link href="/scan" className={styles.btnPrimary}>
                <NavIcon name="qr" size={16} />
                <span>Scan Package QR</span>
              </Link>
              <Link href="/auth/register" className={styles.btnSecondary}>
                Create Passenger Account
              </Link>
            </div>
          </div>

          <aside className={styles.workflowPanel}>
            <h2 className={styles.panelTitle}>Audit &amp; Resolution Workflow</h2>
            <ol className={styles.workflowList}>
              <li>
                <strong>1. Package Registration:</strong> Vendor uploads meal details and generates a unique QR label.
              </li>
              <li>
                <strong>2. Admin Approval:</strong> Railway Administration verifies and approves the package for scanning.
              </li>
              <li>
                <strong>3. Passenger Feedback:</strong> Passenger scans QR to rate food or file a hygiene complaint.
              </li>
              <li>
                <strong>4. Field Inspection:</strong> Assigned Inspector investigates and files an evidence-backed report.
              </li>
              <li>
                <strong>5. Final Verification:</strong> Admin reviews findings and confirms resolution or reopens the case.
              </li>
            </ol>
          </aside>
        </section>

        <section className={styles.directorySection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>System Portals</h2>
            <p className={styles.sectionSub}>
              Each role operates in a separate portal with scoped access and permissions.
            </p>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Portal</th>
                  <th>Responsibilities</th>
                  <th>Access</th>
                </tr>
              </thead>
              <tbody>
                {PORTAL_DIRECTORY.map((item) => (
                  <tr key={item.role}>
                    <td className={styles.roleCell}>{item.role}</td>
                    <td className={styles.purposeCell}>{item.purpose}</td>
                    <td className={styles.accessCell}>
                      <div className={styles.accessLinks}>
                        <Link href={item.primaryHref} className={styles.portalLink}>
                          {item.primaryLabel} →
                        </Link>
                        {item.secondaryHref && (
                          <Link href={item.secondaryHref} className={styles.secondaryLink}>
                            {item.secondaryLabel}
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        © 2026 RailGuard · Railway Food Quality Audit &amp; Passenger Feedback System
      </footer>
    </div>
  );
}
