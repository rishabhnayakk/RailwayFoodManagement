/* components/layout/VendorLayout.jsx
 * Navigation Shell for Vendor (Catering Partner) Portal.
 *
 * Mirrors the structure of InspectorLayout — dark sidebar, main content area.
 * Strictly limits access to the authenticated vendor's own data only.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentUserProfile, signOutUser } from "@/lib/auth";
import styles from "./VendorLayout.module.css";

const VENDOR_NAV = [
  { href: "/vendor",           icon: "🏠", label: "Dashboard"    },
  { href: "/vendor/packages",  icon: "📦", label: "My Packages"  },
  { href: "/vendor/feedback",  icon: "⭐", label: "Feedback"     },
  { href: "/vendor/complaints", icon: "⚠️", label: "Complaints"  },
];

export default function VendorLayout({ children, title = "Vendor Portal" }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [profile, setProfile] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    async function checkVendorAuth() {
      const authData = await getCurrentUserProfile();
      if (!authData?.user) {
        router.push("/auth/login");
        return;
      }
      if (authData.profile?.role !== "vendor" && authData.profile?.role !== "admin") {
        router.push("/auth/login");
        return;
      }
      setProfile(authData.profile);
    }
    checkVendorAuth();
  }, [router]);

  async function handleSignOut() {
    await signOutUser();
    router.push("/auth/login");
  }

  return (
    <div className={styles.shell}>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className={styles.overlay} onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>🏪</div>
          <div>
            <div className={styles.logoName}>RailGuard</div>
            <div className={styles.logoSub}>Catering Partner Portal</div>
          </div>
        </div>

        <nav className={styles.nav}>
          {VENDOR_NAV.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/vendor" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.footer}>
          <button onClick={handleSignOut} className={styles.signOut}>
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className={styles.mainArea}>
        <header className={styles.header}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Hamburger for mobile */}
            <button
              className={styles.menuBtn}
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              ☰
            </button>
            <h1 className={styles.title}>{title}</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)" }}>
              {profile?.full_name || "Catering Partner"}
            </span>
            <span
              style={{
                fontSize: "0.72rem",
                background: "#dcfce7",
                color: "#166534",
                padding: "3px 8px",
                borderRadius: "999px",
                fontWeight: 700,
              }}
            >
              VENDOR
            </span>
          </div>
        </header>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
