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
    const match = parsed.pathname.match(/\/scan\/([^/]+)/);
    if (match) return decodeURIComponent(match[1]);
  } catch {
    // A QR may contain the raw package token rather than a URL.
  }
  return raw;
}

export default function ScanPage() {
  const [token, setToken] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraMessage, setCameraMessage] = useState(
    "Tap Start QR Scanner and allow camera access to scan a package."
  );
  const [cameraError, setCameraError] = useState("");
  const scannerRef = useRef(null);
  const startingRef = useRef(false);
  const handledScanRef = useRef(false);
  const mountedRef = useRef(false);
  const router = useRouter();

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setCameraActive(false);

    if (!scanner) return;
    try {
      if (scanner.isScanning) await scanner.stop();
    } catch (error) {
      console.warn("RailGuard camera stop:", error);
    }
    try {
      scanner.clear();
    } catch (error) {
      // The scanner may not have finished initializing.
      console.warn("RailGuard scanner cleanup:", error);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        (async () => {
          try {
            if (scanner.isScanning) await scanner.stop();
          } catch {}
          try {
            scanner.clear();
          } catch {}
        })();
      }
    };
  }, []);

  const openToken = useCallback((value) => {
    if (handledScanRef.current) return;
    const cleanToken = tokenFromQr(value);
    if (!cleanToken) return;
    handledScanRef.current = true;
    void stopCamera();
    router.push(`/scan/${encodeURIComponent(cleanToken)}`);
  }, [router, stopCamera]);

  async function startCamera() {
    if (startingRef.current || scannerRef.current?.isScanning) return;
    startingRef.current = true;
    handledScanRef.current = false;
    setCameraError("");
    setCameraMessage("Requesting camera access…");

    let scanner = null;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Camera requires a secure HTTPS connection. Open the deployed RailGuard website in Chrome."
        );
      }

      const { Html5Qrcode } = await import("html5-qrcode");
      if (!mountedRef.current) return;

      const config = {
        fps: 10,
        qrbox: (viewWidth, viewHeight) => {
          const side = Math.floor(Math.min(viewWidth, viewHeight, 300) * 0.78);
          return { width: Math.max(160, side), height: Math.max(160, side) };
        },
        disableFlip: false,
      };

      scanner = new Html5Qrcode("railguard-qr-reader", { verbose: false });
      scannerRef.current = scanner;
      setCameraMessage("Starting the rear camera…");

      try {
        await scanner.start({ facingMode: "environment" }, config,
          (decodedText) => openToken(decodedText),
          () => {}
        );
      } catch (rearCameraError) {
        // Some mobile browsers reject facingMode; retry with a concrete camera ID.
        try {
          if (scannerRef.current === scanner) scannerRef.current = null;
          try { scanner.clear(); } catch {}
          const cameras = await Html5Qrcode.getCameras();
          if (!cameras?.length) throw rearCameraError;

          const rearCamera = cameras.slice().reverse().find((camera) =>
            /back|rear|environment|world/i.test(camera.label || "")
          ) || cameras[cameras.length - 1];

          scanner = new Html5Qrcode("railguard-qr-reader", { verbose: false });
          scannerRef.current = scanner;
          await scanner.start(rearCamera.id, config,
            (decodedText) => openToken(decodedText),
            () => {}
          );
        } catch {
          throw rearCameraError;
        }
      }

      if (!mountedRef.current) {
        await stopCamera();
        return;
      }
      setCameraActive(true);
      setCameraMessage("Camera is live. Hold the QR code steady inside the scan area.");
    } catch (error) {
      if (scanner && scannerRef.current === scanner) {
        await stopCamera();
      }
      const rawMessage = String(error?.message || error || "");
      let message = "Could not start the camera. Close other apps using it, then try again.";
      if (/permission|notallowed|denied/i.test(rawMessage)) {
        message = "Camera permission was denied. Allow camera access for this website in your browser settings, then try again.";
      } else if (/notfound|no camera|device.*not found/i.test(rawMessage)) {
        message = "No camera was found on this device. Use the manual token field below.";
      } else if (/secure|https/i.test(rawMessage)) {
        message = rawMessage;
      } else if (/in use|could not start video source|trackstart/i.test(rawMessage)) {
        message = "The camera may be in use by another app or browser tab. Close it and try again.";
      }
      if (mountedRef.current) {
        setCameraError(message);
        setCameraMessage("Camera is currently off.");
      }
      console.error("RailGuard QR scanner error:", error);
    } finally {
      startingRef.current = false;
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
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
              <span className={cameraActive ? styles.liveBadge : styles.offBadge}>
                {cameraActive ? "● LIVE" : "CAMERA OFF"}
              </span>
            </div>
            <div className={styles.videoFrame}>
              <div id="railguard-qr-reader" className={styles.qrReader} />
              {!cameraActive && (
                <div className={styles.videoPlaceholder}>
                  <span>▦</span>
                  <small>Camera preview will appear here</small>
                </div>
              )}
            </div>
            <p className={styles.scannerHint}>{cameraMessage}</p>
            {cameraError && <p className={styles.cameraError} role="alert">{cameraError}</p>}
            {cameraActive ? (
              <Button variant="outline" full onClick={stopCamera}>Stop Camera</Button>
            ) : (
              <Button variant="primary" full onClick={startCamera}>📷 Start QR Scanner</Button>
            )}
            <p className={styles.permissionNote}>
              Camera starts only after you tap the button. Scanning happens on this device.
            </p>
          </div>

          <div className={styles.divider}><span className={styles.dividerSpan}>Or Enter Token Manually</span></div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <label htmlFor="token" className={styles.label}>Package QR Token or QR URL</label>
            <input
              id="token"
              type="text"
              placeholder="Paste QR token or scanned link"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              className={styles.input}
              required
            />
            <Button type="submit" variant="primary" full>Verify Package Details →</Button>
          </form>

          <p className={styles.notice}>
            🔒 No account is required to submit feedback. Camera access is used only when you tap Start QR Scanner.
          </p>
        </div>
      </div>
    </div>
  );
}
