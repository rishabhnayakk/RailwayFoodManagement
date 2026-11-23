/* components/ui/Badge.jsx
 *
 * Small coloured pill labels for status and severity.
 *
 * JAVASCRIPT CONCEPT: Computed property names
 *   styles[status] looks up the CSS class by the value of `status`.
 *   If status = "pending", it uses styles.pending.
 */

import styles from "./Badge.module.css";
import { STATUS_LABELS, SEVERITY_LABELS } from "@/lib/constants";

export function StatusBadge({ status }) {
  const label = STATUS_LABELS[status] ?? status ?? "—";
  const cls   = styles[status] ?? "";
  return <span className={`${styles.badge} ${cls}`}>{label}</span>;
}

export function SeverityBadge({ severity }) {
  const label = SEVERITY_LABELS[severity] ?? severity ?? "—";
  const cls   = styles[severity] ?? "";
  return <span className={`${styles.badge} ${cls}`}>{label}</span>;
}
