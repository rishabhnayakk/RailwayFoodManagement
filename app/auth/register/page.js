/* app/auth/register/page.js — Passenger Registration */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { registerPassenger } from "@/lib/auth";
import styles from "../auth.module.css";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleRegister(e) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    try {
      const data = await registerPassenger({
        email,
        password,
        fullName,
        phone,
      });

      setSuccess(true);
      if (data?.session) router.push("/passenger");
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
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
        <div className={styles.brand}>RailGuard</div>
      </div>

      <div className={styles.main}>
        <div className={styles.card}>
          <span className={`${styles.badgeHeader} ${styles.badgePassenger}`}>
            Passenger Registration
          </span>
          <h1 className={styles.title}>Create Passenger Account</h1>
          <p className={styles.subtitle}>
            Register to track your food quality complaints and rating history.
          </p>

          {error && <div className={styles.errorBanner}>{error}</div>}
          {success && (
            <div className={styles.successBanner}>
              Account created. If email confirmation is enabled, check your inbox before signing in.
            </div>
          )}

          <form onSubmit={handleRegister} className={styles.form}>
            <Input
              label="Full Name"
              type="text"
              placeholder="e.g. Ramesh Kumar"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <Input
              label="Email Address"
              type="email"
              placeholder="e.g. ramesh@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Mobile Number (Optional)"
              type="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Input
              label="Password"
              type="password"
              placeholder="Min. 6 characters"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Input
              label="Confirm Password"
              type="password"
              placeholder="Re-enter password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />

            <Button type="submit" variant="primary" full loading={loading}>
              Create Account
            </Button>
          </form>

          <p className={styles.footerText}>
            Already have an account?
            <Link href="/auth/login" className={styles.footerLink}>
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
