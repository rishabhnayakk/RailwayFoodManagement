/* components/ui/Badge.jsx
 * Small coloured status, severity, and role indicator pills.
 */

import styles from "./Badge.module.css";
import { STATUS_LABELS, SEVERITY_LABELS, ROLE_LABELS } from "@/lib/constants";

export function StatusBadge({ status }) {
  const normalized = status ? status.toLowerCase() : "submitted";
  const label = STATUS_LABELS[normalized] ?? status ?? "—";
  const cls = styles[normalized] ?? "";
  return <span className={`${styles.badge} ${cls}`}>{label}</span>;
}

export function SeverityBadge({ severity }) {
  const normalized = severity ? severity.toLowerCase() : "medium";
  const label = SEVERITY_LABELS[normalized] ?? severity ?? "—";
  const cls = styles[normalized] ?? "";
  return <span className={`${styles.badge} ${cls}`}>{label}</span>;
}

export function RoleBadge({ role }) {
  const label = ROLE_LABELS[role] ?? role ?? "User";
  const cls =
    role === "admin"
      ? styles.roleAdmin
      : role === "inspector"
      ? styles.roleInspector
      : styles.rolePassenger;
  return <span className={`${styles.badge} ${cls}`}>{label}</span>;
}
