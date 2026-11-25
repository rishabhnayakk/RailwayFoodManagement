"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import styles from "./scan.module.css";

function tokenFromQr(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    const match = parsed.pathname.match(/\\/scan\\/([^/]+)/);
    if (match) return decodeURIComponent(match[1]);
  } catch {
    // The QR may contain a raw token instead of a URL.
  }
  return raw;
}

export default function ScanPage() {
  const [token, setToken] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraMessage, setCameraMessage] = useState("Tap below to start the camera and scan a package QR code.");
  const [cameraError, setCameraError] = useState("");
  const scannerRef = useRef(null);
  const startingRef = useRef(false);
  const router = useRouter();

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setCameraActive(false);
    if (scanner) {
      try {
        if (scanner.isScanning) await scanner.stop();
      } catch (error) {
        console.warn("Camera stop:", error);
      }
      try {
        scanner.clear();
      } catch (error) {
        console.warn("Scanner cleanup:", error);
      }
    }
  }, []);

  useEffect(() => () => {
    const scanner = scannerRef.current;
    if (scanner) {
      if (scanner.isScanning) scanner.stop().catch(() => {});
      scanner.clear();
      scannerRef.current = null;
    }
  }, []);

  function openToken(value) {
    const cleanToken = tokenFromQr(value);
    if (!cleanToken) return;
    stopCamera();
    router.push(`/scan/${encodeURIComponent(cleanToken)}`);
  }

  async function startCamera() {
    if (startingRef.current || scannerRef.current?.isScanning) return;
    startingRef.current = true;
    setCameraError("");
    setCameraMessage("Starting camera…");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access needs HTTPS. Open the deployed RailGuard website in Chrome.");
      }
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("railguard-qr-reader", { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: (viewWidth, viewHeight) => {
            const size = Math.floor(Math.min(viewWidth, viewHeight) * 0.72);
            return { width: size, height: size };
          },
          aspectRatio: 1.333,
          rememberLastUsedCamera: true,
        },
        (decodedText) => openToken(decodedText),
        () => {}
      );
      setCameraActive(true);
      setCameraMessage("Camera is live. Point it steadily at the RailGuard QR code.");
    } catch (error) {
      await stopCamera();
      const message = error?.message || "Unable to start the camera. Check browser site permissions and try again.";
      setCameraError(message);
      setCameraMessage("Camera is currently off.");
    } finally {
      startingRef.current = false;
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (token.trim()) openToken(token);
  }

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <Link href="/" className={styles.backLink}>← Back to Home</Link>
        <div className={styles.brand}><span>🛡️</span><span>RailGuard</span></div>
      </div>

      <div className={styles.body}>
        <div className={styles.card}>
          <div className={styles.iconBox}>📱</div>
          <h1 className={styles.title}>Scan Food Package QR</h1>
          <p className={styles.subtitle}>
            Scan the official RailGuard QR printed on the food package to verify the vendor and share your feedback.
          </p>

          <div className={styles.scannerArea}>
            <div className={styles.scannerHeader}>
              <strong>QR Camera Scanner</strong>
              <span className={cameraActive ? styles.liveBadge : styles.offBadge}>{cameraActive ? "● LIVE" : "CAMERA OFF"}</span>
            </div>
            <div className={styles.videoFrame}>
              <div id="railguard-qr-reader" className={styles.qrReader} />
              {!cameraActive && <div className={styles.videoPlaceholder}><span>▦</span><small>Camera preview will appear here</small></div>}
            </div>
            <p className={styles.scannerHint}>{cameraMessage}</p>
            {cameraError && <p className={styles.cameraError} role="alert">{cameraError}</p>}
            {cameraActive ? (
              <Button variant="outline" full onClick={stopCamera}>Stop Camera</Button>
            ) : (
              <Button variant="primary" full onClick={startCamera}>📷 Start QR Scanner</Button>
            )}
            <p className={styles.permissionNote}>Camera starts only after you tap the button. The QR scan is processed on this device.</p>
          </div>

          <div className={styles.divider}><span className={styles.dividerSpan}>Or Enter Token Manually</span></div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <label htmlFor="token" className={styles.label}>Package QR Token or QR URL</label>
            <input id="token" type="text" placeholder="Paste QR token or scanned link" value={token} onChange={(e) => setToken(e.target.value)} className={styles.input} required />
            <Button type="submit" variant="primary" full>Verify Package Details →</Button>
          </form>

          <p className={styles.notice}>🔒 No account is required to submit feedback. Camera access is used only when you tap Start QR Scanner.</p>
        </div>
      </div>
    </div>
  );
}
