/* components/ui/Input.jsx
 * Reusable form field primitives (Input, Textarea, Select) with forwardRef support.
 */

import { forwardRef } from "react";
import styles from "./Input.module.css";

export const Input = forwardRef(function Input(
  { label, error, hint, required, className = "", ...props },
  ref
) {
  const id = props.id ?? props.name;
  return (
    <div className={styles.group}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={`${styles.input} ${error ? styles.error : ""} ${className}`}
        {...props}
      />
      {error && <p className={styles.error_text}>{error}</p>}
      {hint && !error && <p className={styles.hint}>{hint}</p>}
    </div>
  );
});

export const Textarea = forwardRef(function Textarea(
  { label, error, hint, required, className = "", ...props },
  ref
) {
  const id = props.id ?? props.name;
  return (
    <div className={styles.group}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        className={`${styles.textarea} ${error ? styles.error : ""} ${className}`}
        {...props}
      />
      {error && <p className={styles.error_text}>{error}</p>}
      {hint && !error && <p className={styles.hint}>{hint}</p>}
    </div>
  );
});

export const Select = forwardRef(function Select(
  { label, error, hint, required, children, className = "", ...props },
  ref
) {
  const id = props.id ?? props.name;
  return (
    <div className={styles.group}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      <select
        ref={ref}
        id={id}
        className={`${styles.select} ${error ? styles.error : ""} ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className={styles.error_text}>{error}</p>}
      {hint && !error && <p className={styles.hint}>{hint}</p>}
    </div>
  );
});
