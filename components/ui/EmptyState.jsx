/* components/ui/EmptyState.jsx
 *
 * Shown when a list or table has no records.
 *
 * WHY THIS MATTERS:
 *   A blank white space is confusing. An empty state clearly tells
 *   the user: "Nothing here yet — here's what to do."
 *   This replaces all previous mock data placeholders.
 *
 * HOW TO EXPLAIN:
 *   "Instead of fake data, I show a proper empty state message.
 *    This is a standard UX pattern used in professional apps."
 */

import styles from "./EmptyState.module.css";

export default function EmptyState({
  icon = "📭",
  title = "Nothing here yet",
  description = "Records will appear here once they are added.",
  action,
}) {
  return (
    <div className={styles.wrap}>
      <div className={styles.icon}>{icon}</div>
      <p className={styles.title}>{title}</p>
      <p className={styles.desc}>{description}</p>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
