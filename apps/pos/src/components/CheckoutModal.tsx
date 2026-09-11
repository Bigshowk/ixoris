"use client";

import { useMemo, useState } from "react";
import type { CartDTO, PaymentMethod, TenderInput } from "@ixoris/types";
import { formatMoney } from "../lib/format";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Espèces" },
  { value: "CARD", label: "Carte" },
  { value: "MOBILE_MONEY", label: "Mobile Money" },
  { value: "BANK_TRANSFER", label: "Virement" },
  { value: "CHECK", label: "Chèque" },
  { value: "CREDIT", label: "Crédit client" },
];

export interface CheckoutModalProps {
  cart: CartDTO;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (payments: TenderInput[]) => void;
}

export function CheckoutModal({ cart, submitting, onClose, onConfirm }: CheckoutModalProps) {
  const [tenders, setTenders] = useState<TenderInput[]>([{ method: "CASH", amount: cart.total }]);

  const totalTendered = useMemo(() => tenders.reduce((sum, t) => sum + (t.amount || 0), 0), [tenders]);
  const remaining = Math.max(0, Math.round((cart.total - totalTendered) * 100) / 100);
  const change = Math.max(0, Math.round((totalTendered - cart.total) * 100) / 100);
  const canConfirm = totalTendered >= cart.total - 0.01 && !submitting;

  function updateTender(index: number, patch: Partial<TenderInput>) {
    setTenders((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function addTender() {
    setTenders((prev) => [...prev, { method: "CASH", amount: remaining }]);
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-slate-900 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">Encaissement</h2>
        <p className="mt-1 text-3xl font-bold text-emerald-400">{formatMoney(cart.total)}</p>

        <div className="mt-4 space-y-3">
          {tenders.map((tender, index) => (
            <div key={index} className="flex items-center gap-2">
              <select
                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-2 text-sm text-white"
                value={tender.method}
                onChange={(e) => updateTender(index, { method: e.target.value as PaymentMethod })}
              >
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                step="0.01"
                className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white"
                value={tender.amount}
                onChange={(e) => updateTender(index, { amount: Number(e.target.value) })}
              />
            </div>
          ))}
          <button type="button" className="text-sm text-emerald-400 hover:text-emerald-300" onClick={addTender}>
            + Ajouter un moyen de paiement
          </button>
        </div>

        <div className="mt-4 space-y-1 text-sm">
          {remaining > 0 && <p className="text-amber-400">Reste à payer : {formatMoney(remaining)}</p>}
          {change > 0 && <p className="text-emerald-400">Monnaie à rendre : {formatMoney(change)}</p>}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            className="flex-1 rounded-lg border border-slate-700 py-2 text-slate-300 hover:bg-slate-800"
            onClick={onClose}
            disabled={submitting}
          >
            Annuler
          </button>
          <button
            className="flex-1 rounded-lg bg-emerald-500 py-2 font-medium text-slate-950 disabled:opacity-50"
            onClick={() => onConfirm(tenders.filter((t) => t.amount > 0))}
            disabled={!canConfirm}
          >
            {submitting ? "Validation…" : "Valider"}
          </button>
        </div>
      </div>
    </div>
  );
}
