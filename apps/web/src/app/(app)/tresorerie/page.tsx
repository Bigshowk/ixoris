"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../lib/api";
import { useI18n } from "../../../lib/i18n-context";
import { formatXOF, formatDate } from "../../../lib/format";
import { SectionTabs } from "../../../components/SectionTabs";

type CashBoxType = "PETTY_CASH" | "SAFE";
type CashMovementType = "DEPOSIT" | "WITHDRAWAL" | "EXPENSE" | "ADJUSTMENT";

interface GlAccount {
  code: string;
  name: string;
}

interface CashBox {
  id: string;
  name: string;
  type: CashBoxType;
  glAccount: GlAccount;
}

interface CashMovement {
  id: string;
  type: CashMovementType;
  amount: string | number;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  journalEntryId: string | null;
}

const MOVEMENT_TYPES: CashMovementType[] = ["DEPOSIT", "WITHDRAWAL", "EXPENSE", "ADJUSTMENT"];

export default function TresorerieCashboxesPage() {
  const { t } = useI18n();
  const [cashboxes, setCashboxes] = useState<CashBox[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<CashBoxType>("PETTY_CASH");
  const [glAccountCode, setGlAccountCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [movements, setMovements] = useState<CashMovement[] | null>(null);
  const [movementType, setMovementType] = useState<CashMovementType>("DEPOSIT");
  const [amount, setAmount] = useState("");
  const [counterAccountCode, setCounterAccountCode] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [movementError, setMovementError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function loadCashboxes() {
    apiFetch<CashBox[]>("/treasury/cashboxes")
      .then(setCashboxes)
      .catch((err) => setListError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  useEffect(() => {
    loadCashboxes();
  }, []);

  async function handleCreate() {
    setFormError(null);
    if (!name || !glAccountCode) {
      setFormError(t("errors.required"));
      return;
    }
    try {
      await apiFetch("/treasury/cashboxes", {
        method: "POST",
        body: JSON.stringify({ name, type, glAccountCode }),
      });
      setName("");
      setGlAccountCode("");
      loadCashboxes();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  function selectCashbox(id: string) {
    setSelectedId(id);
    setMovements(null);
    apiFetch<CashMovement[]>(`/treasury/cashboxes/${id}/movements`)
      .then(setMovements)
      .catch((err) => setActionError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  async function handleAddMovement() {
    setMovementError(null);
    if (!selectedId || !amount || !counterAccountCode) {
      setMovementError(t("errors.required"));
      return;
    }
    try {
      await apiFetch(`/treasury/cashboxes/${selectedId}/movements`, {
        method: "POST",
        body: JSON.stringify({
          type: movementType,
          amount: Number(amount),
          counterAccountCode,
          reference: reference || undefined,
          notes: notes || undefined,
        }),
      });
      setAmount("");
      setCounterAccountCode("");
      setReference("");
      setNotes("");
      selectCashbox(selectedId);
    } catch (err) {
      setMovementError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function handlePostApproved(movementId: string) {
    setActionError(null);
    try {
      await apiFetch(`/treasury/cashboxes/movements/${movementId}/post`, { method: "POST" });
      if (selectedId) selectCashbox(selectedId);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  return (
    <div>
      <SectionTabs
        tabs={[
          { href: "/tresorerie", label: t("tresorerie.tabs.cashboxes") },
          { href: "/tresorerie/transferts", label: t("tresorerie.tabs.transfers") },
        ]}
      />

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("tresorerie.cashboxes.new")}</h2>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <input
            type="text"
            placeholder={t("tresorerie.cashboxes.name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as CashBoxType)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="PETTY_CASH">{t("tresorerie.cashboxes.types.PETTY_CASH")}</option>
            <option value="SAFE">{t("tresorerie.cashboxes.types.SAFE")}</option>
          </select>
          <input
            type="text"
            placeholder={t("tresorerie.cashboxes.glAccountCode")}
            value={glAccountCode}
            onChange={(e) => setGlAccountCode(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        {formError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{formError}</p>}
        <button onClick={handleCreate} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          {t("tresorerie.cashboxes.create")}
        </button>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          {listError && <p className="text-sm text-red-500 dark:text-red-400">{listError}</p>}
          {!listError && !cashboxes && <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
          {cashboxes && cashboxes.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("tresorerie.cashboxes.noCashboxes")}</p>}
          {cashboxes && cashboxes.length > 0 && (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {cashboxes.map((cb) => (
                <li key={cb.id}>
                  <button
                    onClick={() => selectCashbox(cb.id)}
                    className={`w-full py-2 text-left text-sm ${
                      selectedId === cb.id ? "font-medium text-indigo-700 dark:text-indigo-300" : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {cb.name} <span className="text-xs text-slate-500 dark:text-slate-400">({t(`tresorerie.cashboxes.types.${cb.type}`)} · {cb.glAccount.code})</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          {!selectedId && <p className="text-sm text-slate-500 dark:text-slate-400">{t("tresorerie.cashboxes.selectCashbox")}</p>}
          {selectedId && (
            <>
              <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{t("tresorerie.cashboxes.newMovement")}</h3>
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                <select
                  value={movementType}
                  onChange={(e) => setMovementType(e.target.value as CashMovementType)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {MOVEMENT_TYPES.map((mt) => (
                    <option key={mt} value={mt}>
                      {t(`tresorerie.cashboxes.movementTypes.${mt}`)}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder={t("tresorerie.cashboxes.amount")}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <input
                  type="text"
                  placeholder={t("tresorerie.cashboxes.counterAccountCode")}
                  value={counterAccountCode}
                  onChange={(e) => setCounterAccountCode(e.target.value)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <input
                  type="text"
                  placeholder={t("tresorerie.cashboxes.reference")}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <input
                  type="text"
                  placeholder={t("tresorerie.cashboxes.notes")}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              {movementError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{movementError}</p>}
              <button onClick={handleAddMovement} className="mb-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
                {t("tresorerie.cashboxes.record")}
              </button>

              {actionError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{actionError}</p>}
              {!movements && <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
              {movements && movements.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("tresorerie.cashboxes.noMovements")}</p>}
              {movements && movements.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                        <th className="py-2">{t("tresorerie.cashboxes.movements")}</th>
                        <th className="py-2 text-right">{t("tresorerie.cashboxes.amount")}</th>
                        <th className="py-2">{t("rh.leave.date")}</th>
                        <th className="py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((m) => (
                        <tr key={m.id} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-2 text-slate-900 dark:text-white">
                            {t(`tresorerie.cashboxes.movementTypes.${m.type}`)}
                            {m.reference && <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">({m.reference})</span>}
                          </td>
                          <td className="py-2 text-right text-slate-700 dark:text-slate-300">{formatXOF(m.amount)}</td>
                          <td className="py-2 text-slate-500 dark:text-slate-400">{formatDate(m.createdAt)}</td>
                          <td className="py-2 text-right">
                            {!m.journalEntryId && (
                              <button
                                onClick={() => handlePostApproved(m.id)}
                                className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500"
                                title={t("tresorerie.cashboxes.awaitingApproval")}
                              >
                                {t("tresorerie.cashboxes.postApproved")}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
