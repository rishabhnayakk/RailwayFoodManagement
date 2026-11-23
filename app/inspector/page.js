/* app/inspector/page.js
 * Quality Inspector Portal
 *
 * Designated railway inspectors log in to review assigned food quality cases,
 * record inspection observations, and submit resolution reports.
 * Clean JSX, no external icon library.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import styles from "./inspector.module.css";

export default function InspectorPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleLogin(e) {
    e.preventDefault();
    alert("Inspector authentication will verify against Supabase Auth in Phase 5.");
  }

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <div className={styles.topBar}>
        <Link href="/" className={styles.backLink}>
          ← Back to Home
        </Link>
        <div className={styles.brand}>
          <span>🔍</span>
          <span>RailGuard Inspector</span>
        </div>
      </div>

      {/* Login Card */}
      <div className={styles.body}>
        <div className={styles.card}>
          <div className={styles.iconBox}>📋</div>
          <h1 className={styles.title}>Inspector Portal</h1>
          <p className={styles.subtitle}>
            Authorized railway quality officials sign in to examine assigned complaints and record field investigation findings.
          </p>

          <div className={styles.infoBox}>
            <div className={styles.infoTitle}>Official Access Only</div>
            <p className={styles.infoDesc}>
              Credentials are issued by the Railway Quality Administration. All inspections are cryptographically recorded in the audit logs.
            </p>
          </div>

          <form onSubmit={handleLogin} className={styles.form}>
            <div>
              <label htmlFor="ins-email" className={styles.label}>
                Official Email
              </label>
              <input
                id="ins-email"
                type="email"
                placeholder="inspector@railways.gov.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
                required
              />
            </div>
            <div>
              <label htmlFor="ins-password" className={styles.label}>
                Password
              </label>
              <input
                id="ins-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                required
              />
            </div>
            <Button type="submit" variant="primary" full>
              Sign In to Assigned Cases →
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
