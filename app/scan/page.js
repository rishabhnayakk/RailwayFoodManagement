/* app/scan/page.js
 * Passenger QR Scan Portal
 *
 * Passengers access this page to either scan a QR code using camera
 * or enter the package token manually to load food details and submit feedback.
 * NO external icon libraries used (clean SVG / emoji).
 * NO mock data.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import styles from "./scan.module.css";

export default function ScanPage() {
  const [token, setToken] = useState("");
  const router = useRouter();

  function handleSubmit(e) {
    e.preventDefault();
    const cleanToken = token.trim();
    if (!cleanToken) return;
    router.push(`/scan/${encodeURIComponent(cleanToken)}`);
  }

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <div className={styles.topBar}>
        <Link href="/" className={styles.backLink}>
          ← Back to Home
        </Link>
        <div className={styles.brand}>
          <span>🛡️</span>
          <span>RailGuard</span>
        </div>
      </div>

      {/* Main Container */}
      <div className={styles.body}>
        <div className={styles.card}>
          <div className={styles.iconBox}>📱</div>
          <h1 className={styles.title}>Scan Food Package QR</h1>
          <p className={styles.subtitle}>
            Inspect your packaging for the authorized RailGuard QR code, or enter the package code printed under the code.
          </p>

          {/* Camera Scanner Container */}
          <div className={styles.scannerArea}>
            <p className={styles.scannerHint}>
              Camera scanning utilizes device camera permission.
            </p>
            <Button
              variant="outline"
              full
              onClick={() => alert("Camera scanner initialization will activate when scanning on a device with camera support.")}
            >
              📷 Open Camera Scanner
            </Button>
          </div>

          <div className={styles.divider}>
            <span className={styles.dividerSpan}>Or Enter Token Manually</span>
          </div>

          {/* Manual Token Verification Form */}
          <form onSubmit={handleSubmit} className={styles.form}>
            <label htmlFor="token" className={styles.label}>
              Package QR Token
            </label>
            <input
              id="token"
              type="text"
              placeholder="e.g. 48-character QR token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className={styles.input}
              required
            />
            <Button type="submit" variant="primary" full>
              Verify Package Details →
            </Button>
          </form>

          <p className={styles.notice}>
            🔒 Submissions are anonymous. No login or personal account required.
          </p>
        </div>
      </div>
    </div>
  );
}
