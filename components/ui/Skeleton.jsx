/* components/ui/Skeleton.jsx
 * Loading placeholder shapes while data fetches from Supabase.
 */

import styles from "./Skeleton.module.css";

export function SkeletonLine({ width = "100%", height = 16 }) {
  return (
    <div
      className={`skeleton ${styles.line}`}
      style={{ width, height }}
    />
  );
}

export function SkeletonBox({ width = "100%", height = 80 }) {
  return (
    <div
      className={`skeleton ${styles.box}`}
      style={{ width, height }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div style={{ padding: "20px", background: "white", borderRadius: "10px", border: "1px solid var(--border)" }}>
      <SkeletonLine width="40%" height={14} />
      <SkeletonLine width="60%" height={28} />
      <SkeletonLine width="50%" height={12} />
    </div>
  );
}
