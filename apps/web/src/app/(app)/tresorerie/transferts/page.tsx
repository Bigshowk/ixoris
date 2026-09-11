"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../../lib/api";
import { useI18n } from "../../../../lib/i18n-context";
import { formatXOF, formatDate } from "../../../../lib/format";
import { SectionTabs } from "../../../../components/SectionTabs";

type HolderType = "REGISTER" | "CASHBOX" | "BANK_ACCOUNT";
type TransferStatus = "PENDING" | "COMPLETED" | "CANCELLED";

interface Register {
  id: string;
  name: string;
}

interface CashBox {
  id: string;
  name: string;
}

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
}

interface Account {
  code: string;
  name: string;
}

interface CashTransfer {
  id: string;
  amount: string | number;
  reference: string | null;
  status: TransferStatus;
  createdAt: string;
  fromAccount: Account;
  toAccount: Account;
}

const HOLDER_TYPES: HolderType[] = ["REGISTER", "CASHBOX", "BANK_ACCOUNT"];

export default function TresorerieTransfersPage() {
  const { t } = useI18n();
  const [transfers, setTransfers] = useState<CashTransfer[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [registers, setRegisters] = useState<Register[]>([]);
  const [cashboxes, setCashboxes] = useState<CashBox[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  const [fromType, setFromType] = useState<HolderType>("CASHBOX");
  const [fromId, setFromId] = useState("");
  const [toType, setToType] = useState<HolderType>("CASHBOX");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function loadTransfers() {
    apiFetch<CashTransfer[]>("/treasury/transfers")
      .then(setTransfers)
      .catch((err) => setListError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  useEffect(() => {
    loadTransfers();
    apiFetch<Register[]>("/pos/registers").then(setRegisters).catch(() => {});
    apiFetch<CashBox[]>("/treasury/cashboxes").then(setCashboxes).catch(() => {});
    apiFetch<BankAccount[]>("/accounting/bank-accounts").then(setBankAccounts).catch(() => {});
  }, []);

  function optionsFor(type: HolderType): { id: string; label: string }[] {
    if (type === "REGISTER") return registers.map((r) => ({ id: r.id, label: r.name }));
    if (type === "CASHBOX") return cashboxes.map((c) => ({ id: c.id, label: c.name }));
    return bankAccounts.map((b) => ({ id: b.id, label: `${b.bankName} — ${b.accountNumber}` }));
  }

  async function handleCreate() {
    setFormError(null);
    if (!fromId || !toId || !amount) {
      setFormError(t("errors.required"));
      return;
    }
    try {
      await apiFetch("/treasury/transfers", {
        method: "POST",
        body: JSON.stringify({ fromType, fromId, toType, toId, amount: Number(amount), reference: reference || undefined }),
      });
      setFromId("");
      setToId("");
      setAmount("");
      setReference("");
      loadTransfers();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function handleComplete(id: string) {
    setActionError(null);
    try {
      await apiFetch(`/treasury/transfers/${id}/complete`, { method: "POST" });
      loadTransfers();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function handleCancel(id: string) {
    setActionError(null);
    try {
      await apiFetch(`/treasury/transfers/${id}/cancel`, { method: "POST" });
      loadTransfers();
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
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("tresorerie.transfers.new")}</h2>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="flex gap-2">
            <select
              value={fromType}
              onChange={(e) => {
                setFromType(e.target.value as HolderType);
                setFromId("");
              }}
              className="w-1/2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              {HOLDER_TYPES.map((ht) => (
                <option key={ht} value={ht}>
                  {t(`tresorerie.transfers.holderTypes.${ht}`)}
                </option>
              ))}
            </select>
            <select
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
              className="w-1/2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">{t("tresorerie.transfers.from")}</option>
              {optionsFor(fromType).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <select
              value={toType}
              onChange={(e) => {
                setToType(e.target.value as HolderType);
                setToId("");
              }}
              className="w-1/2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              {HOLDER_TYPES.map((ht) => (
                <option key={ht} value={ht}>
                  {t(`tresorerie.transfers.holderTypes.${ht}`)}
                </option>
              ))}
            </select>
            <select
              value={toId}
              onChange={(e) => setToId(e.target.value)}
              className="w-1/2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">{t("tresorerie.transfers.to")}</option>
              {optionsFor(toType).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <input
            type="number"
            placeholder={t("tresorerie.transfers.amount")}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <input
            type="text"
            placeholder={t("tresorerie.transfers.reference")}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        {formError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{formError}</p>}
        <button onClick={handleCreate} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          {t("tresorerie.transfers.create")}
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        {actionError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{actionError}</p>}
        {listError && <p className="text-sm text-red-500 dark:text-red-400">{listError}</p>}
        {!listError && !transfers && <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
        {transfers && transfers.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("tresorerie.transfers.noTransfers")}</p>}
        {transfers && transfers.length > 0 && (
          <div className="space-y-3">
            {transfers.map((tr) => (
              <div key={tr.id} className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {tr.fromAccount.code} — {tr.fromAccount.name} → {tr.toAccount.code} — {tr.toAccount.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        tr.status === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : tr.status === "CANCELLED"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                      }`}
                    >
                      {t(`tresorerie.transfers.statuses.${tr.status}`)}
                    </span>
                    {tr.status === "PENDING" && (
                      <>
                        <button
                          onClick={() => handleComplete(tr.id)}
                          className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500"
                        >
                          {t("tresorerie.transfers.complete")}
                        </button>
                        <button
                          onClick={() => handleCancel(tr.id)}
                          className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          {t("tresorerie.transfers.cancel")}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatXOF(tr.amount)} · {formatDate(tr.createdAt)}
                  {tr.reference ? ` · ${tr.reference}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
