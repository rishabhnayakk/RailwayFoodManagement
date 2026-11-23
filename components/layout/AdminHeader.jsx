/* components/layout/AdminHeader.jsx
 * Top bar: hamburger menu (mobile), page title, user info.
 */

import styles from "./AdminHeader.module.css";

export default function AdminHeader({ onMenuClick, title }) {
  return (
    <header className={styles.header}>
      {/* Hamburger — only visible on mobile */}
      <button
        className={styles.menuBtn}
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        ☰
      </button>

      <h1 className={styles.title}>{title}</h1>

      <div className={styles.userBadge}>
        <div className={styles.avatar}>A</div>
        <span>Admin</span>
      </div>
    </header>
  );
}
