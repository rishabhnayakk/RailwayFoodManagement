/* app/auth/login/page.js
 * Passenger / Universal Portal Login
 * Authenticates user and redirects to the appropriate dashboard
 * based on the user's role: admin -> /admin, inspector -> /inspector, passenger -> /passenger.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { signInUser, getCurrentUserProfile } from "@/lib/auth";
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
      if (!role) throw new Error("Your account profile is missing. Please contact the RailGuard administrator.");
      if (role === "admin") {
        router.push("/admin");
      } else if (role === "inspector") {
        router.push("/inspector");
      } else if (role === "vendor") {
        router.push("/vendor");
      } else if (role === "passenger") {
        router.push("/passenger");
      } else {
        throw new Error("This account has an unsupported role. Contact the administrator.");
      }
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
        <div className={styles.brand}>
          <span>🛡️</span>
          <span>RailGuard</span>
        </div>
      </div>

      <div className={styles.main}>
        <div className={styles.card}>
          <span className={`${styles.badgeHeader} ${styles.badgePassenger}`}>
            Unified Access Portal
          </span>
          <h1 className={styles.title}>Sign In to RailGuard</h1>
          <p className={styles.subtitle}>
            One secure sign-in for Railway Admin, Food Inspector, Catering Vendor and Passenger accounts.
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
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" variant="primary" full loading={loading}>
              Sign In →
            </Button>
          </form>

          <p className={styles.footerText}>
            New passenger?
            <Link href="/auth/register" className={styles.footerLink}>
              Create an account
            </Link>
          </p>

          <div className={styles.roleLinks}>Role-based access · Secure account verification</div>
        </div>
      </div>
    </div>
  );
}
