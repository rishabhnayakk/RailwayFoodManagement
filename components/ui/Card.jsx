/* components/ui/Card.jsx
 *
 * Reusable card container — the main building block of every dashboard page.
 *
 * HOW IT WORKS:
 *   Card wraps content with a white background, border, and shadow.
 *   CardHeader adds a title bar at the top.
 *   CardBody / CardContent is the main content area.
 *   CardFooter adds an optional bottom row.
 */

import styles from "./Card.module.css";

export function Card({ children, className = "" }) {
  return <div className={`${styles.card} ${className}`}>{children}</div>;
}

export function CardHeader({ children, className = "" }) {
  return <div className={`${styles.header} ${className}`}>{children}</div>;
}

export function CardTitle({ children }) {
  return <h3 className={styles.title}>{children}</h3>;
}

export function CardBody({ children, className = "" }) {
  return <div className={`${styles.body} ${className}`}>{children}</div>;
}

export const CardContent = CardBody;

export function CardFooter({ children, className = "" }) {
  return <div className={`${styles.footer} ${className}`}>{children}</div>;
}
