"use client";

import type { CartDTO } from "@ixoris/types";
import { formatMoney } from "../lib/format";
import { useI18n } from "../lib/i18n-context";

export interface CartPanelProps {
  cart: CartDTO | null;
  onIncrement: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
}

export function CartPanel({ cart, onIncrement, onRemove }: CartPanelProps) {
  const { t } = useI18n();

  if (!cart || cart.items.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-slate-500">{t("pos.emptyCart")}</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
      {cart.items.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{item.productName}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {formatMoney(item.unitPrice)} x {item.quantity}
              {item.discount > 0 ? ` — ${formatMoney(item.discount)}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="h-7 w-7 rounded-full bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
              onClick={() => onIncrement(item.id, item.quantity - 1)}
              disabled={item.quantity <= 1}
            >
              −
            </button>
            <span className="w-6 text-center text-sm text-slate-900 dark:text-white">{item.quantity}</span>
            <button
              className="h-7 w-7 rounded-full bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
              onClick={() => onIncrement(item.id, item.quantity + 1)}
            >
              +
            </button>
            <span className="w-20 text-right text-sm font-semibold text-slate-900 dark:text-white">{formatMoney(item.total)}</span>
            <button className="text-red-500 hover:text-red-400 dark:text-red-400 dark:hover:text-red-300" onClick={() => onRemove(item.id)} aria-label="Remove">
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
