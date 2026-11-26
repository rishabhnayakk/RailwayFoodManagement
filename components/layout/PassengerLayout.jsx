/* components/layout/PassengerLayout.jsx */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserProfile, signOutUser, getPortalHomeForRole } from "@/lib/auth";
import NavIcon from "@/components/ui/NavIcon";
import styles from "./PassengerLayout.module.css";

export default function PassengerLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    async function checkAuth() {
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
        if (!authData?.user) {
          router.replace("/auth/login");
          return;
        }
        if (authData.profile?.role !== "passenger") {
          router.replace(getPortalHomeForRole(authData.profile?.role));
          return;
        }
        if (active) {
          setProfile(authData.profile);
          setAuthorized(true);
        }
      } catch {
        router.replace("/auth/login");
      } finally {
        if (active) setChecking(false);
      }
    }
    checkAuth();
    return () => {
      active = false;
    };
  }, [router]);

  async function handleSignOut() {
    await signOutUser();
    router.replace("/auth/login");
    router.refresh();
  }

  if (checking || !authorized) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
        Verifying Passenger session…
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <nav className={styles.nav}>
        <Link href="/passenger" className={styles.brand}>
          <div className={styles.brandName}>RailGuard</div>
          <div className={styles.brandSub}>Passenger Portal</div>
        </Link>

        <div className={styles.navLinks}>
          <Link
            href="/passenger"
            className={`${styles.link} ${pathname === "/passenger" ? styles.linkActive : ""}`}
          >
            Overview
          </Link>
          <Link
            href="/passenger/complaints"
            className={`${styles.link} ${pathname === "/passenger/complaints" ? styles.linkActive : ""}`}
          >
            Complaints
          </Link>
          <Link
            href="/passenger/feedback"
            className={`${styles.link} ${pathname === "/passenger/feedback" ? styles.linkActive : ""}`}
          >
            Ratings
          </Link>

          <Link href="/scan" className={styles.scanBtn}>
            <NavIcon name="qr" size={15} />
            <span>Scan QR</span>
          </Link>

          <div className={styles.userMenu}>
            <span className={styles.userName}>{profile?.full_name || "Passenger"}</span>
            <button type="button" onClick={handleSignOut} className={styles.signOutBtn}>
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <main className={styles.content}>{children}</main>
    </div>
  );
}
