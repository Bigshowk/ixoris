"use client";

import { useRef, useState } from "react";
import { useI18n } from "../lib/i18n-context";

export interface SignaturePadProps {
  onCapture: (dataUrl: string) => void;
}

/** Touch/mouse signature capture — exports a PNG data URL on submit. */
export function SignaturePad({ onCapture }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const { t } = useI18n();

  function getContext(): CanvasRenderingContext2D | null {
    return canvasRef.current?.getContext("2d") ?? null;
  }

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const ctx = getContext();
    const { x, y } = pointerPos(e);
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = getContext();
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  }

  function end() {
    drawing.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = getContext();
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }

  function submit() {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    onCapture(canvas.toDataURL("image/png"));
  }

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        width={320}
        height={160}
        className="w-full touch-none rounded-md border border-slate-300 bg-white dark:border-slate-700"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="flex gap-2">
        <button type="button" className="flex-1 rounded-md border border-slate-300 py-2 text-sm dark:border-slate-700" onClick={clear}>
          {t("delivery.clearSignature")}
        </button>
        <button
          type="button"
          disabled={!hasDrawn}
          className="flex-1 rounded-md bg-emerald-500 py-2 text-sm font-medium text-slate-950 disabled:opacity-50"
          onClick={submit}
        >
          {t("delivery.submit")}
        </button>
      </div>
    </div>
  );
}
