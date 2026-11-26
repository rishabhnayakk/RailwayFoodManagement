/* app/auth/forgot-password/page.js — Request Supabase Password Reset Email */

"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { requestPasswordReset } from "@/lib/auth";
import styles from "../auth.module.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSent(false);
    setLoading(true);

    try {
      const redirectTo = `${window.location.origin}/auth/reset-password`;
      await requestPasswordReset(email, redirectTo);
      setSent(true);
    } catch (err) {
      setError(err.message || "Unable to send password reset email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <Link href="/auth/login" className={styles.backLink}>
          ← Back to Sign In
        </Link>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">RG</span>
          <span>RAILGUARD</span>
        </Link>
      </div>

      <div className={styles.main}>
        <div className={styles.card}>
          <span className={`${styles.badgeHeader} ${styles.badgePassenger}`}>
            Account Recovery
          </span>
          <h1 className={styles.title}>Reset Your Password</h1>
          <p className={styles.subtitle}>
            Enter your registered email address and we will send you a password reset link.
          </p>

          {error && <div className={styles.errorBanner}>{error}</div>}
          {sent && (
            <div className={styles.successBanner}>
              Password reset link sent to <strong>{email}</strong>. Please check your inbox and follow the link to set a new password.
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <Input
              label="Registered Email Address"
              type="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" variant="primary" full loading={loading}>
              Send Reset Link
            </Button>
          </form>

          <p className={styles.footerText}>
            Remembered your password?
            <Link href="/auth/login" className={styles.footerLink}>
              Back to Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
