/* components/layout/InspectorLayout.jsx
 * Navigation Shell for Quality Inspectors.
 * Restricts view strictly to assigned cases and investigation tools.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { INSPECTOR_NAV } from "@/lib/constants";
import { getCurrentUserProfile, signOutUser } from "@/lib/auth";
import styles from "./InspectorLayout.module.css";

export default function InspectorLayout({ children, title = "Inspector Portal" }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    async function checkInspectorAuth() {
      const authData = await getCurrentUserProfile();
      if (!authData?.user) {
        router.push("/inspector/login");
        return;
      }

      if (authData.profile?.role !== "inspector" && authData.profile?.role !== "admin") {
        router.push("/auth/login");
        return;
      }

      setProfile(authData.profile);
    }
    checkInspectorAuth();
  }, [router]);

  async function handleSignOut() {
    await signOutUser();
    router.push("/inspector/login");
  }

  return (
    <div className={styles.shell}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>🔍</div>
          <div>
            <div className={styles.logoName}>RailGuard</div>
            <div className={styles.logoSub}>Quality Inspectorate</div>
          </div>
        </div>

        <nav className={styles.nav}>
          {INSPECTOR_NAV.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/inspector" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
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
          <h1 className={styles.title}>{title}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)" }}>
              Officer: {profile?.full_name || "Quality Inspector"}
            </span>
            <span style={{ fontSize: "0.72rem", background: "#ede9fe", color: "#6d28d9", padding: "3px 8px", borderRadius: "999px", fontWeight: 700 }}>
              INSPECTOR
            </span>
          </div>
        </header>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
