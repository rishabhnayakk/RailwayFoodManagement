/* app/auth/login/page.js — Passenger & Unified Portal Sign In */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { signInUser, getCurrentUserProfile, getPortalHomeForRole } from "@/lib/auth";
import styles from "../auth.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInUser(email, password);
      const userProfile = await getCurrentUserProfile();
      const role = userProfile?.profile?.role;
      if (!role) throw new Error("Account profile is missing. Contact RailGuard Administration.");
      router.replace(getPortalHomeForRole(role));
      router.refresh();
    } catch (err) {
      setError(err.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <Link href="/" className={styles.backLink}>
          ← Back to Home
        </Link>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">RG</span>
          <span>RAILGUARD</span>
        </Link>
      </div>

      <div className={styles.main}>
        <div className={styles.card}>
          <span className={`${styles.badgeHeader} ${styles.badgePassenger}`}>
            Role-Based Portal Access
          </span>
          <h1 className={styles.title}>Sign In to RailGuard</h1>
          <p className={styles.subtitle}>
            Sign in with your RailGuard credentials. You will be routed automatically to your authorized portal.
          </p>

          {error && <div className={styles.errorBanner}>{error}</div>}

          <form onSubmit={handleLogin} className={styles.form}>
            <Input
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className={styles.forgotRow}>
              <Link href="/auth/forgot-password" className={styles.forgotLink}>
                Forgot Password?
              </Link>
            </div>
            <Button type="submit" variant="primary" full loading={loading}>
              Sign In
            </Button>
          </form>

          <p className={styles.footerText}>
            New passenger?
            <Link href="/auth/register" className={styles.footerLink}>
              Create an account
            </Link>
          </p>

          <div className={styles.roleLinks}>
            <Link href="/vendor/login">Vendor Login</Link> ·{" "}
            <Link href="/inspector/login">Inspector Login</Link> ·{" "}
            <Link href="/admin/login">Admin Login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
