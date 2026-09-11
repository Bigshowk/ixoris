"use client";

import { useState } from "react";
import type { DeliveryDTO } from "../lib/delivery-api";
import { deliveryApi } from "../lib/delivery-api";
import { useI18n } from "../lib/i18n-context";
import { formatMoney } from "../lib/format";
import { getCurrentPosition } from "../lib/geolocation";
import { SignaturePad } from "./SignaturePad";
import { QrPackageScanner } from "./QrPackageScanner";

export interface DeliveryDetailProps {
  delivery: DeliveryDTO;
  onBack: () => void;
  onUpdated: (delivery: DeliveryDTO) => void;
}

type PodMode = "choose" | "signature" | "qr";

export function DeliveryDetail({ delivery, onBack, onUpdated }: DeliveryDetailProps) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [podMode, setPodMode] = useState<PodMode>("choose");
  const [failing, setFailing] = useState(false);
  const [failureReason, setFailureReason] = useState("");

  async function run(action: () => Promise<DeliveryDTO>) {
    setBusy(true);
    setError(null);
    try {
      const updated = await action();
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.networkError"));
    } finally {
      setBusy(false);
    }
  }

  // GPS is captured at every key step (pickup, departure, delivery) — best-effort, never blocks the action if denied/unavailable.
  const markLoaded = () => run(async () => deliveryApi.updateStatus(delivery.id, "LOADED", undefined, undefined, await getCurrentPosition()));
  const startTransit = () => run(async () => deliveryApi.updateStatus(delivery.id, "IN_TRANSIT", undefined, undefined, await getCurrentPosition()));
  const markFailed = () =>
    run(async () => deliveryApi.updateStatus(delivery.id, "FAILED", failureReason || undefined, undefined, await getCurrentPosition()));

  function handleSignature(dataUrl: string) {
    run(async () => deliveryApi.submitProofOfDelivery(delivery.id, "SIGNATURE", dataUrl, undefined, await getCurrentPosition()));
  }

  function handleQrScan(payload: string) {
    run(async () => deliveryApi.submitProofOfDelivery(delivery.id, "QR_SCAN", payload, undefined, await getCurrentPosition()));
  }

  return (
    <div className="space-y-4">
      <button className="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" onClick={onBack}>
        ← {t("common.back")}
      </button>

      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{delivery.number}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {t("delivery.address")}: {delivery.address}
        </p>
        {delivery.customer && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t("delivery.customer")}: {delivery.customer.name} {delivery.customer.phone ? `— ${delivery.customer.phone}` : ""}
          </p>
        )}
        {delivery.zone && <p className="text-sm text-slate-600 dark:text-slate-300">{delivery.zone.name}</p>}
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {t("delivery.fee")}: {formatMoney(delivery.feeAmount)}
        </p>
      </div>

      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

      {delivery.status === "PENDING" && (
        <button disabled={busy} className="w-full rounded-lg bg-emerald-500 py-3 font-medium text-slate-950 disabled:opacity-50" onClick={markLoaded}>
          {t("delivery.markLoaded")}
        </button>
      )}

      {delivery.status === "LOADED" && (
        <button disabled={busy} className="w-full rounded-lg bg-emerald-500 py-3 font-medium text-slate-950 disabled:opacity-50" onClick={startTransit}>
          {t("delivery.startTransit")}
        </button>
      )}

      {delivery.status === "IN_TRANSIT" && !failing && (
        <div className="space-y-3">
          {podMode === "choose" && (
            <div className="grid grid-cols-2 gap-2">
              <button className="rounded-lg bg-emerald-500 py-3 text-sm font-medium text-slate-950" onClick={() => setPodMode("signature")}>
                {t("delivery.captureSignature")}
              </button>
              <button className="rounded-lg bg-emerald-500 py-3 text-sm font-medium text-slate-950" onClick={() => setPodMode("qr")}>
                {t("delivery.scanPackage")}
              </button>
            </div>
          )}
          {podMode === "signature" && <SignaturePad onCapture={handleSignature} />}
          {podMode === "qr" && <QrPackageScanner onDetected={handleQrScan} />}

          <button className="w-full rounded-lg border border-red-400 py-2 text-sm text-red-500 dark:text-red-400" onClick={() => setFailing(true)}>
            {t("delivery.markFailed")}
          </button>
        </div>
      )}

      {delivery.status === "IN_TRANSIT" && failing && (
        <div className="space-y-3">
          <label className="block text-sm text-slate-600 dark:text-slate-300">
            {t("delivery.failureReason")}
            <textarea
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              value={failureReason}
              onChange={(e) => setFailureReason(e.target.value)}
              rows={3}
            />
          </label>
          <div className="flex gap-2">
            <button className="flex-1 rounded-md border border-slate-300 py-2 text-sm dark:border-slate-700" onClick={() => setFailing(false)}>
              {t("common.cancel")}
            </button>
            <button disabled={busy} className="flex-1 rounded-md bg-red-500 py-2 text-sm font-medium text-white disabled:opacity-50" onClick={markFailed}>
              {t("delivery.markFailed")}
            </button>
          </div>
        </div>
      )}

      {(delivery.status === "DELIVERED" || delivery.status === "FAILED" || delivery.status === "CANCELLED") && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t(`delivery.status.${delivery.status}`)}
          {delivery.failureReason ? ` — ${delivery.failureReason}` : ""}
        </p>
      )}
    </div>
  );
}
