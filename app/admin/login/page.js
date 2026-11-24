/* app/admin/login/page.js
 * Railway Administrator Dedicated Login
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { signInUser, getCurrentUserProfile } from "@/lib/auth";
import styles from "../../auth/auth.module.css";

export default function AdminLoginPage() {
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

      if (userProfile?.profile?.role !== "admin") {
        setError("Unauthorized access. This area is reserved for Railway Department Administrators.");
        return;
      }

      router.push("/admin");
    } catch (err) {
      setError(err.message || "Failed to sign in. Please verify your administrator credentials.");
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
        <div className={styles.brand}>
          <span>🛡️</span>
          <span>RailGuard Authority</span>
        </div>
      </div>

      <div className={styles.main}>
        <div className={styles.card}>
          <span className={`${styles.badgeHeader} ${styles.badgeAdmin}`}>
            Railway Administration
          </span>
          <h1 className={styles.title}>Admin Portal Sign In</h1>
          <p className={styles.subtitle}>
            Authorized Railway Department Authority access for quality oversight, vendor auditing, and case assignment.
          </p>

          {error && <div className={styles.errorBanner}>{error}</div>}

          <form onSubmit={handleLogin} className={styles.form}>
            <Input
              label="Official Administrator Email"
              type="email"
              placeholder="admin@railguard.gov.in"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" variant="primary" full loading={loading}>
              Sign In to Admin Panel →
            </Button>
          </form>

          <div className={styles.roleLinks}>
            <Link href="/auth/login">Passenger Portal</Link>
            <span>•</span>
            <Link href="/inspector/login">Inspector Portal</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
