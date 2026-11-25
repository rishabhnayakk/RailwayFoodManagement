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
    // A printed QR may contain the raw token rather than a full URL.
  }
  return raw;
}

export default function ScanPage() {
  const [token, setToken] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraMessage, setCameraMessage] = useState("Tap below to allow camera access and scan a package QR code.");
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanTimerRef = useRef(null);
  const detectorRef = useRef(null);
  const router = useRouter();

  const stopCamera = useCallback(() => {
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  useEffect(() => () => {
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  function openToken(value) {
    const cleanToken = tokenFromQr(value);
    if (!cleanToken) return;
    stopCamera();
    router.push(`/scan/${encodeURIComponent(cleanToken)}`);
  }

  async function startCamera() {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is unavailable. Open this page on HTTPS in a modern browser, or enter the QR token manually.");
      return;
    }
    if (!("BarcodeDetector" in window)) {
      setCameraError("This browser can open the camera but does not support built-in QR detection. Try Chrome on Android, or enter the token manually.");
      return;
    }

    try {
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      detectorRef.current = detector;
      setCameraMessage("Requesting camera permission…");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      if (!videoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        return;
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraActive(true);
      setCameraMessage("Point your camera at the RailGuard QR code.");

      const detect = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          if (videoRef.current.readyState >= 2) {
            const codes = await detector.detect(videoRef.current);
            if (codes.length && codes[0].rawValue) {
              openToken(codes[0].rawValue);
              return;
            }
          }
        } catch (error) {
          console.warn("QR detection retry:", error);
        }
        scanTimerRef.current = setTimeout(detect, 250);
      };
      detect();
    } catch (error) {
      stopCamera();
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        setCameraError("Camera permission was denied. Allow camera access in your browser/site settings, then try again.");
      } else if (error.name === "NotFoundError") {
        setCameraError("No camera was found on this device.");
      } else {
        setCameraError(error.message || "Unable to start the camera. Please try again.");
      }
      setCameraMessage("Camera is currently off.");
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
              <video ref={videoRef} className={styles.video} muted playsInline />
              {!cameraActive && <div className={styles.videoPlaceholder}><span>▦</span><small>Camera preview will appear here</small></div>}
              {cameraActive && <div className={styles.scanCorners} aria-hidden="true"><i /><i /><i /><i /></div>}
            </div>
            <p className={styles.scannerHint}>{cameraMessage}</p>
            {cameraError && <p className={styles.cameraError} role="alert">{cameraError}</p>}
            {cameraActive ? (
              <Button variant="outline" full onClick={stopCamera}>Stop Camera</Button>
            ) : (
              <Button variant="primary" full onClick={startCamera}>📷 Allow Camera & Start Scanning</Button>
            )}
            <p className={styles.permissionNote}>Your browser will ask for camera permission. Video is processed on this device and is not uploaded.</p>
          </div>

          <div className={styles.divider}><span className={styles.dividerSpan}>Or Enter Token Manually</span></div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <label htmlFor="token" className={styles.label}>Package QR Token or QR URL</label>
            <input id="token" type="text" placeholder="Paste QR token or scanned link" value={token} onChange={(e) => setToken(e.target.value)} className={styles.input} required />
            <Button type="submit" variant="primary" full>Verify Package Details →</Button>
          </form>

          <p className={styles.notice}>🔒 No account is required to submit feedback. Camera access is used only when you tap Start Scanning.</p>
        </div>
      </div>
    </div>
  );
}
