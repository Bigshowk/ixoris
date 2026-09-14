"use client";

import { useEffect, useRef, useState } from "react";

// Same rationale as DeliveryMap.tsx: no network access in this workspace to install a QR
// package, so the `qrcode` UMD build is loaded from a CDN at runtime instead.
declare global {
  interface Window {
    QRCode?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

const QRCODE_JS = "https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js";

let qrLoadPromise: Promise<void> | null = null;

function loadQrCodeLib(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.QRCode) return Promise.resolve();
  if (qrLoadPromise) return qrLoadPromise;

  qrLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = QRCODE_JS;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("QRCode library failed to load"));
    document.body.appendChild(script);
  });
  return qrLoadPromise;
}

export interface TotpQrCodeProps {
  otpauthUrl: string;
  errorLabel?: string;
}

/** Renders an `otpauth://` provisioning URL as a scannable QR code, entirely client-side. */
export function TotpQrCode({ otpauthUrl, errorLabel }: TotpQrCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadQrCodeLib()
      .then(() => {
        if (cancelled || !canvasRef.current) return;
        window.QRCode.toCanvas(canvasRef.current, otpauthUrl, { width: 200, margin: 1 }, (err: unknown) => {
          if (err) setError(true);
        });
      })
      .catch(() => setError(true));
    return () => {
      cancelled = true;
    };
  }, [otpauthUrl]);

  if (error) {
    return <p className="text-sm text-red-500 dark:text-red-400">{errorLabel ?? "Could not load the QR code"}</p>;
  }
  return <canvas ref={canvasRef} className="rounded-lg border border-slate-200 dark:border-slate-700" />;
}
