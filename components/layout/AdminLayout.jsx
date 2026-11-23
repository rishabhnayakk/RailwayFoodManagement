/* components/layout/AdminLayout.jsx
 *
 * Shell that wraps every admin page: Sidebar + Header + main content.
 *
 * HOW IT WORKS:
 *   useState(false) tracks whether the mobile sidebar is open.
 *   The sidebar gets `open` and `onClose` as props.
 *   `children` is the actual page content (injected by Next.js routing).
 *
 * JAVASCRIPT CONCEPT: useState hook
 *   const [sidebarOpen, setSidebarOpen] = useState(false);
 *   - sidebarOpen is the current value (starts as false = closed).
 *   - setSidebarOpen is the function that changes it.
 *   When the state changes, React re-renders only what changed.
 */

"use client";

import { useState } from "react";
import AdminSidebar from "./AdminSidebar";
import AdminHeader from "./AdminHeader";
import styles from "./AdminLayout.module.css";

export default function AdminLayout({ children, title = "Dashboard" }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
