"use client";

import { useEffect, useRef } from "react";

export interface UseHidScannerOptions {
  /** Max delay (ms) between keystrokes to still count as the same scan burst. Human typing is much slower. */
  maxInterKeyDelayMs?: number;
  /** Minimum characters before Enter for a burst to be treated as a barcode. */
  minLength?: number;
  enabled?: boolean;
}

/**
 * USB/Bluetooth barcode "douchettes" act as HID keyboards: they type the
 * barcode digits then send Enter, all within a few milliseconds — far faster
 * than a human. This listens on `window` (no input needs focus) and tells
 * scanner bursts apart from normal typing purely by inter-key timing.
 */
export function useHidScanner(onScan: (barcode: string) => void, options: UseHidScannerOptions = {}) {
  const { maxInterKeyDelayMs = 50, minLength = 3, enabled = true } = options;
  const bufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      const now = performance.now();
      const elapsed = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (event.key === "Enter") {
        const candidate = bufferRef.current;
        bufferRef.current = "";
        if (candidate.length >= minLength) {
          onScanRef.current(candidate);
        }
        return;
      }

      if (event.key.length !== 1) return; // ignore Shift, Tab, arrows...

      if (elapsed > maxInterKeyDelayMs) {
        // Gap too long: this keystroke starts a new burst (or is human typing).
        bufferRef.current = event.key;
      } else {
        bufferRef.current += event.key;
      }
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [enabled, maxInterKeyDelayMs, minLength]);
}
