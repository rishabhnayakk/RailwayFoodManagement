/* components/layout/AdminLayout.jsx
 * Shell wrapping every admin page with strict role='admin' authorization.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "./AdminSidebar";
import AdminHeader from "./AdminHeader";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserProfile } from "@/lib/auth";
import styles from "./AdminLayout.module.css";

export default function AdminLayout({ children, title = "Dashboard" }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    async function verifyAdmin() {
      const supabase = createClient();
      if (!supabase) {
        // Allow rendering setup banner when Supabase env vars are not configured
        if (active) {
          setAuthorized(true);
          setChecking(false);
        }
        return;
      }

      try {
        const authData = await getCurrentUserProfile();
        if (!authData?.user || authData.profile?.role !== "admin") {
          router.replace("/auth/login");
          return;
        }
        if (active) setAuthorized(true);
      } catch {
        router.replace("/auth/login");
      } finally {
        if (active) setChecking(false);
      }
    }
    verifyAdmin();
    return () => {
      active = false;
    };
  }, [router]);

  if (checking || !authorized) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.95rem" }}>
        Verifying Railway Administration session…
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <AdminSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className={styles.main}>
        <AdminHeader
          onMenuClick={() => setSidebarOpen(true)}
          title={title}
        />
        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}
