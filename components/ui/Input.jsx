/* components/ui/Input.jsx
 * Reusable form field primitives (Input, Textarea, Select) with forwardRef support.
 */

import { forwardRef, useState } from "react";
import styles from "./Input.module.css";

export const Input = forwardRef(function Input(
  { label, error, hint, required, className = "", type = "text", ...props },
  ref
) {
  const id = props.id ?? props.name;
  const isPassword = type === "password";
  const [showPassword, setShowPassword] = useState(false);
  const resolvedType = isPassword && showPassword ? "text" : type;

  return (
    <div className={styles.group}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      <div className={isPassword ? styles.passwordWrap : undefined}>
        <input
          ref={ref}
          id={id}
          type={resolvedType}
          className={`${styles.input} ${isPassword ? styles.inputWithToggle : ""} ${error ? styles.error : ""} ${className}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            className={styles.toggleBtn}
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        )}
      </div>
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
