/* components/layout/AdminSidebar.jsx */

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ADMIN_NAV, APP_NAME } from "@/lib/constants";
import { signOutUser } from "@/lib/auth";
import NavIcon from "@/components/ui/NavIcon";
import styles from "./AdminSidebar.module.css";

export default function AdminSidebar({ open, onClose }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await signOutUser();
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <>
      {open && <div className={styles.overlay} onClick={onClose} />}

      <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`}>
        <div className={styles.logo}>
          <div>
            <div className={styles.logoName}>{APP_NAME}</div>
            <div className={styles.logoSub}>Administration Console</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close menu">
            ×
          </button>
        </div>

        <nav className={styles.nav}>
          {ADMIN_NAV.map(({ label, href, icon }) => {
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
                <NavIcon name={icon} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <button type="button" onClick={handleSignOut} className={styles.signOut}>
            <NavIcon name="signout" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
