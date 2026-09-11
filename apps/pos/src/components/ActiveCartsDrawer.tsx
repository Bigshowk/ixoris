"use client";

import type { CartDTO } from "@ixoris/types";
import { formatMoney } from "../lib/format";
import { useI18n } from "../lib/i18n-context";

export interface ActiveCartsDrawerProps {
  carts: CartDTO[];
  currentCartId: string | null;
  onResume: (cart: CartDTO) => void;
  onClose: () => void;
}

/** Lets a vendor on a tablet/till browse every ACTIVE cart in the store — including one started on a phone — and switch this device to it. */
export function ActiveCartsDrawer({ carts, currentCartId, onResume, onClose }: ActiveCartsDrawerProps) {
  const { t } = useI18n();

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-sm flex-col bg-white shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t("pos.activeCarts.title")}</h2>
          <button className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {carts.length === 0 && <p className="p-4 text-sm text-slate-500 dark:text-slate-400">{t("pos.activeCarts.empty")}</p>}
          {carts.map((c) => {
            const isCurrent = c.id === currentCartId;
            return (
              <button
                key={c.id}
                className={`flex w-full flex-col items-start gap-1 border-b border-slate-100 p-4 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 ${
                  isCurrent ? "bg-indigo-50 dark:bg-indigo-500/10" : ""
                }`}
                onClick={() => onResume(c)}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {t("pos.activeCarts.cartLabel")} #{c.id.slice(-6).toUpperCase()}
                  </span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{formatMoney(c.total)}</span>
                </div>
                <div className="flex w-full items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    {c.items.length} {t("pos.activeCarts.items")}
                  </span>
                  {isCurrent && <span className="text-indigo-600 dark:text-indigo-400">{t("pos.activeCarts.current")}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
