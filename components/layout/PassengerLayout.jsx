/* components/layout/PassengerLayout.jsx
 * Navigation shell for the Railway Passenger Portal.
 * Provides sticky top navigation, user profile summary, quick QR scan link,
 * and session sign out.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentUserProfile, signOutUser } from "@/lib/auth";
import styles from "./PassengerLayout.module.css";

export default function PassengerLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    async function checkAuth() {
      const authData = await getCurrentUserProfile();
      if (!authData?.user) {
        // Passenger is not logged in -> redirect to login
        router.push("/auth/login");
        return;
      }
      setProfile(authData.profile);
    }
    checkAuth();
  }, [router]);

  async function handleSignOut() {
    await signOutUser();
    router.push("/auth/login");
  }

  return (
    <div className={styles.shell}>
      {/* Top Navbar */}
      <nav className={styles.nav}>
        <Link href="/passenger" className={styles.brand}>
          <div className={styles.logoIcon}>🛡️</div>
          <div>
            <div className={styles.brandName}>RailGuard Passenger</div>
            <div className={styles.brandSub}>Quality Tracking & Feedback</div>
          </div>
        </Link>

        <div className={styles.navLinks}>
          <Link
            href="/passenger"
            className={`${styles.link} ${pathname === "/passenger" ? styles.linkActive : ""}`}
          >
            Dashboard
          </Link>
          <Link
            href="/passenger/complaints"
            className={`${styles.link} ${pathname === "/passenger/complaints" ? styles.linkActive : ""}`}
          >
            My Complaints
          </Link>
          <Link
            href="/passenger/feedback"
            className={`${styles.link} ${pathname === "/passenger/feedback" ? styles.linkActive : ""}`}
          >
            My Ratings
          </Link>

          <Link href="/scan" className={styles.scanBtn}>
            📱 Scan Food QR
          </Link>

          <div className={styles.userMenu}>
            <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.85)" }}>
              {profile?.full_name || "Passenger"}
            </span>
            <button onClick={handleSignOut} className={styles.signOutBtn}>
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className={styles.content}>{children}</main>
    </div>
  );
}
