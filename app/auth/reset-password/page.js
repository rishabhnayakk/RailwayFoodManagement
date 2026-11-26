/* app/auth/reset-password/page.js — Complete Supabase Password Reset */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { updateUserPassword } from "@/lib/auth";
import styles from "../auth.module.css";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let subscription;

    async function initRecovery() {
      if (!supabase) {
        setError("Supabase is not configured.");
        return;
      }

      // Handle PKCE code exchange if Supabase redirects with ?code=...
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (code) {
        const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeErr) {
          setError(exchangeErr.message || "Reset link is invalid or expired.");
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        setReady(true);
      }

      const { data: sub } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
          setReady(true);
        }
      });
      subscription = sub?.subscription;
    }

    initRecovery();

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await updateUserPassword(password);
      setSuccess(true);
      setTimeout(() => {
        router.replace("/auth/login");
      }, 1500);
    } catch (err) {
      setError(err.message || "Failed to update password. Please request a new reset link.");
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
            Set New Password
          </span>
          <h1 className={styles.title}>Choose a New Password</h1>
          <p className={styles.subtitle}>
            Enter your new password below to regain access to your RailGuard account.
          </p>

          {error && <div className={styles.errorBanner}>{error}</div>}
          {success && (
            <div className={styles.successBanner}>
              Password updated successfully. Redirecting to sign in…
            </div>
          )}

          {!ready && !error && !success && (
            <div className={styles.errorBanner}>
              Open this page from the password reset link sent to your email.
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <Input
              label="New Password"
              type="password"
              placeholder="Min. 6 characters"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Input
              label="Confirm New Password"
              type="password"
              placeholder="Re-enter new password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <Button type="submit" variant="primary" full loading={loading} disabled={!ready || success}>
              Update Password
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
