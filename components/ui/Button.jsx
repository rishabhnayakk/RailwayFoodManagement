/* components/ui/Button.jsx
 *
 * A reusable button component.
 *
 * WHAT IT DOES:
 *   Renders a <button> with one of four visual styles (variants)
 *   and optional loading spinner.
 *
 * HOW IT WORKS:
 *   We pass a `variant` prop ("primary", "outline", "danger", "ghost").
 *   The component picks the matching CSS class from Button.module.css.
 *   CSS Modules scope class names to this file so they never clash
 *   with classes in other files.
 *
 * JAVASCRIPT CONCEPT: Default parameters
 *   variant = "primary" means if you don't pass variant, it defaults to "primary".
 */

import styles from "./Button.module.css";

export default function Button({
  children,
  variant = "primary",
  size,
  full = false,
  loading = false,
  disabled = false,
  type = "button",
  onClick,
  className = "",
}) {
  // Build the className string by joining the relevant CSS module classes
  const classes = [
    styles.btn,
    styles[variant] ?? styles.primary,
    size === "sm" ? styles.sm : size === "lg" ? styles.lg : "",
    full ? styles.full : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      {children}
    </button>
  );
}
