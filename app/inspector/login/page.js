/* app/inspector/login/page.js
 * Quality Inspector Dedicated Login
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { signInUser, getCurrentUserProfile } from "@/lib/auth";
import styles from "../../auth/auth.module.css";

export default function InspectorLoginPage() {
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

      if (userProfile?.profile?.role !== "inspector" && userProfile?.profile?.role !== "admin") {
        setError("Unauthorized access. This area is reserved for designated Railway Quality Inspection Officers.");
        return;
      }

      router.push("/inspector");
    } catch (err) {
      setError(err.message || "Failed to sign in. Please verify your inspector credentials.");
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
          <span>🔍</span>
          <span>RailGuard Quality Inspectorate</span>
        </div>
      </div>

      <div className={styles.main}>
        <div className={styles.card}>
          <span className={`${styles.badgeHeader} ${styles.badgeInspector}`}>
            Quality Inspection Officer
          </span>
          <h1 className={styles.title}>Inspector Portal Sign In</h1>
          <p className={styles.subtitle}>
            Sign in to inspect assigned food complaints, examine evidence, and file official inspection reports.
          </p>

          {error && <div className={styles.errorBanner}>{error}</div>}

          <form onSubmit={handleLogin} className={styles.form}>
            <Input
              label="Inspector Official Email"
              type="email"
              placeholder="inspector@railways.gov.in"
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
              Access Assigned Cases →
            </Button>
          </form>

          <div className={styles.roleLinks}>
            <Link href="/auth/login">Passenger Portal</Link>
            <span>•</span>
            <Link href="/admin/login">Admin Portal</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
