/* components/layout/AdminSidebar.jsx
 *
 * The left navigation panel for all admin pages.
 *
 * HOW IT WORKS:
 *   1. usePathname() from Next.js returns the current URL (e.g. "/admin/complaints").
 *   2. We compare each nav link's href to the current URL to decide which is active.
 *   3. On desktop the sidebar is always visible.
 *      On mobile it slides in from the left when `open` is true.
 *
 * JAVASCRIPT CONCEPT: Conditional class names
 *   We use template literals: `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`
 *   This adds the active CSS class only when the link matches the current page.
 */

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ADMIN_NAV, APP_NAME } from "@/lib/constants";
import { signOutUser } from "@/lib/auth";
import styles from "./AdminSidebar.module.css";

/* Nav icon map — using emoji so we have zero icon-library dependencies */
const NAV_ICONS = {
  "/admin":            "🏠",
  "/admin/complaints": "⚠️",
  "/admin/vendors":    "🏪",
  "/admin/qr-codes":  "📱",
  "/admin/inspectors": "🔍",
  "/admin/audit-logs": "📋",
};

export default function AdminSidebar({ open, onClose }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await signOutUser();
    router.push("/auth/login");
  }

  return (
    <>
      {/* Dark overlay — click it to close the sidebar on mobile */}
      {open && <div className={styles.overlay} onClick={onClose} />}

      <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`}>

        {/* ── Logo ── */}
        <div className={styles.logo}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div className={styles.logoIcon}>🛡️</div>
            <div className={styles.logoText}>
              <div className={styles.logoName}>{APP_NAME}</div>
              <div className={styles.logoSub}>Admin Portal</div>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close menu">
            ✕
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className={styles.nav}>
          {ADMIN_NAV.map(({ label, href }) => {
            /* Active if exact match OR starts with (for sub-routes) */
            const isActive =
              pathname === href ||
              (href !== "/admin" && pathname.startsWith(href));

            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
              >
                <span className={styles.navIcon}>{NAV_ICONS[href] ?? "▸"}</span>
                {label}
                {isActive && <span className={styles.navDot} />}
              </Link>
            );
          })}
        </nav>

        {/* ── Sign Out ── */}
        <div className={styles.sidebarFooter}>
          <button onClick={handleSignOut} className={styles.signOut}>
            <span>🚪</span>
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
