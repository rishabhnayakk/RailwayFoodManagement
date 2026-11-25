/* components/ui/EmptyState.jsx
 * Realistic enterprise empty state — clear message without decorative emoji clutter.
 */

import styles from "./EmptyState.module.css";

export default function EmptyState({
  title = "No records found",
  description = "Records will appear here once they are created.",
  action,
}) {
  return (
    <div className={styles.wrap}>
      <p className={styles.title}>{title}</p>
      <p className={styles.desc}>{description}</p>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
