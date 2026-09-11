"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";

export interface CameraScannerProps {
  active: boolean;
  onDetected: (barcode: string) => void;
  /** Cooldown to avoid re-firing on the same still-visible barcode. */
  rescanDelayMs?: number;
}

/** Decodes barcodes/QR codes from the device camera via the Web Camera API + ZXing. */
export function CameraScanner({ active, onDetected, rescanDelayMs = 1500 }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastResultRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active || !videoRef.current) return;

    let cancelled = false;
    const reader = new BrowserMultiFormatReader();

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, (result) => {
        if (!result || cancelled) return;
        const text = result.getText();
        const now = Date.now();
        if (text === lastResultRef.current.text && now - lastResultRef.current.at < rescanDelayMs) return;
        lastResultRef.current = { text, at: now };
        onDetectedRef.current(text);
      })
      .then((controls) => {
        if (cancelled) {
          controls.stop();
        } else {
          controlsRef.current = controls;
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Camera access failed");
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [active, rescanDelayMs]);

  if (!active) return null;

  return (
    <div className="relative overflow-hidden rounded-lg bg-black">
      <video ref={videoRef} className="w-full aspect-video object-cover" muted playsInline />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 text-center text-sm text-red-300">
          Camera indisponible : {error}
        </div>
      )}
    </div>
  );
}
