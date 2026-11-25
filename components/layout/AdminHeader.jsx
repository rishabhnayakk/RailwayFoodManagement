/* components/layout/AdminHeader.jsx */

import styles from "./AdminHeader.module.css";

export default function AdminHeader({ onMenuClick, title }) {
  return (
    <header className={styles.header}>
      <button
        className={styles.menuBtn}
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        ☰
      </button>
      <h1 className={styles.title}>{title}</h1>
      <span className={styles.roleTag}>ADMIN</span>
    </header>
  );
}
