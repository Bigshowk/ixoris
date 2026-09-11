"use client";

import type { DeliveryDTO } from "../lib/delivery-api";
import { useI18n } from "../lib/i18n-context";

const STATUS_COLOR: Record<DeliveryDTO["status"], string> = {
  PENDING: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  LOADED: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  IN_TRANSIT: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  DELIVERED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  FAILED: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  CANCELLED: "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

export function DeliveryCard({ delivery, onClick }: { delivery: DeliveryDTO; onClick: () => void }) {
  const { t } = useI18n();

  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-emerald-400 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="font-medium text-slate-900 dark:text-white">{delivery.number}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[delivery.status]}`}>
          {t(`delivery.status.${delivery.status}`)}
        </span>
      </div>
      <p className="truncate text-sm text-slate-500 dark:text-slate-400">{delivery.address}</p>
      {delivery.customer && <p className="text-xs text-slate-400 dark:text-slate-500">{delivery.customer.name}</p>}
    </button>
  );
}
