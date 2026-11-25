/* components/layout/InspectorLayout.jsx */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { INSPECTOR_NAV } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserProfile, signOutUser } from "@/lib/auth";
import NavIcon from "@/components/ui/NavIcon";
import styles from "./InspectorLayout.module.css";

export default function InspectorLayout({ children, title = "Inspector Portal" }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    async function checkInspectorAuth() {
      const supabase = createClient();
      if (!supabase) {
        if (active) {
          setAuthorized(true);
          setChecking(false);
        }
        return;
      }

      try {
        const authData = await getCurrentUserProfile();
        if (!authData?.user || authData.profile?.role !== "inspector") {
          router.replace("/inspector/login");
          return;
        }
        if (active) {
          setProfile(authData.profile);
          setAuthorized(true);
        }
      } catch {
        router.replace("/inspector/login");
      } finally {
        if (active) setChecking(false);
      }
    }
    checkInspectorAuth();
    return () => {
      active = false;
    };
  }, [router]);

  async function handleSignOut() {
    await signOutUser();
    router.push("/inspector/login");
  }

  if (checking || !authorized) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
        Verifying Quality Inspector session…
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      {mobileOpen && (
        <div className={styles.overlay} onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.logo}>
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
                onClick={() => setMobileOpen(false)}
                className={`${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
              >
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.footer}>
          <button type="button" onClick={handleSignOut} className={styles.signOut}>
            <NavIcon name="signout" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <div className={styles.mainArea}>
        <header className={styles.header}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
            <span style={{ fontSize: "0.84rem", fontWeight: 500, color: "var(--text-muted)" }}>
              {profile?.full_name || "Quality Inspector"}
            </span>
            <span className={styles.roleTag}>INSPECTOR</span>
          </div>
        </header>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
