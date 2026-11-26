/* components/auth/PortalLoginForm.jsx */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { signInUser, getCurrentUserProfile, signOutUser } from "@/lib/auth";
import styles from "@/app/auth/auth.module.css";

export default function PortalLoginForm({
  expectedRole,
  badgeText,
  badgeClass = "",
  title,
  subtitle,
  redirectPath,
  placeholderEmail,
  footerNote,
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInUser(email, password);
      const userProfile = await getCurrentUserProfile();
      const role = userProfile?.profile?.role;

      if (!role) {
        await signOutUser();
        throw new Error("Account profile is missing. Contact RailGuard Administration.");
      }

      if (expectedRole && role !== expectedRole) {
        await signOutUser();
        throw new Error(
          `Access denied: this login is for ${expectedRole} accounts only. Your account role is "${role}".`
        );
      }

      router.replace(redirectPath);
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
          <span className={`${styles.badgeHeader} ${badgeClass}`}>{badgeText}</span>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>

          {error && <div className={styles.errorBanner}>{error}</div>}

          <form onSubmit={handleSubmit} className={styles.form}>
            <Input
              label="Email Address"
              type="email"
              placeholder={placeholderEmail || "you@railguard.in"}
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

          {footerNote && <p className={styles.footerText}>{footerNote}</p>}

          <div className={styles.roleLinks}>
            <Link href="/auth/login">Passenger</Link> ·{" "}
            <Link href="/vendor/login">Vendor</Link> ·{" "}
            <Link href="/inspector/login">Inspector</Link> ·{" "}
            <Link href="/admin/login">Admin</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
