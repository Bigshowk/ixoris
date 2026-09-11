"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../../lib/api";
import { useI18n } from "../../../../lib/i18n-context";
import { formatXOF, formatDate } from "../../../../lib/format";
import { SectionTabs } from "../../../../components/SectionTabs";

interface Customer {
  id: string;
  code: string;
  name: string;
}

interface Invoice {
  id: string;
  number: string;
  customerId: string | null;
  status: string;
  totalTTC: string | number;
  currencyCode: string;
}

type InstallmentStatus = "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";

interface Installment {
  id: string;
  installmentNumber: number;
  dueDate: string;
  amount: string | number;
  status: InstallmentStatus;
}

interface DraftLine {
  dueDate: string;
  amount: string;
}

const OPEN_STATUSES = new Set(["VALIDATED", "PARTIALLY_PAID", "OVERDUE"]);

const STATUS_STYLES: Record<InstallmentStatus, string> = {
  PENDING: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  OVERDUE: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  CANCELLED: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500",
};

export default function CreditInstallmentsPage() {
  const { t } = useI18n();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceId, setInvoiceId] = useState("");
  const [installments, setInstallments] = useState<Installment[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [lines, setLines] = useState<DraftLine[]>([{ dueDate: "", amount: "" }]);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Customer[]>("/crm/customers").then(setCustomers).catch(() => {});
  }, []);

  function selectCustomer(id: string) {
    setCustomerId(id);
    setInvoiceId("");
    setInstallments(null);
    apiFetch<Invoice[]>("/accounting/invoices?type=CUSTOMER")
      .then((all) => setInvoices(all.filter((inv) => inv.customerId === id && OPEN_STATUSES.has(inv.status))))
      .catch(() => setInvoices([]));
  }

  function selectInvoice(id: string) {
    setInvoiceId(id);
    setInstallments(null);
    if (!id) return;
    apiFetch<Installment[]>(`/credit-control/invoices/${id}/installments`)
      .then(setInstallments)
      .catch((err) => setListError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  const selectedInvoice = invoices.find((i) => i.id === invoiceId) ?? null;
  const allocatedTotal = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const remaining = selectedInvoice ? Number(selectedInvoice.totalTTC) - allocatedTotal : 0;

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { dueDate: "", amount: "" }]);
  }

  async function handleGenerate() {
    setFormError(null);
    if (!invoiceId) {
      setFormError(t("errors.required"));
      return;
    }
    const validLines = lines.filter((l) => l.dueDate && Number(l.amount) > 0);
    if (validLines.length === 0) {
      setFormError(t("errors.required"));
      return;
    }
    try {
      await apiFetch(`/credit-control/invoices/${invoiceId}/installments`, {
        method: "POST",
        body: JSON.stringify({
          installments: validLines.map((l) => ({ dueDate: new Date(l.dueDate).toISOString(), amount: Number(l.amount) })),
        }),
      });
      setLines([{ dueDate: "", amount: "" }]);
      selectInvoice(invoiceId);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function handleMarkPaid(id: string) {
    setActionError(null);
    try {
      await apiFetch(`/credit-control/installments/${id}/pay`, { method: "PATCH" });
      selectInvoice(invoiceId);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  return (
    <div>
      <SectionTabs
        tabs={[
          { href: "/credit", label: t("credit.tabs.customers") },
          { href: "/credit/echeanciers", label: t("credit.tabs.installments") },
        ]}
      />

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select
            value={customerId}
            onChange={(e) => selectCustomer(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">{t("credit.customers.selectCustomer")}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
          <select
            value={invoiceId}
            onChange={(e) => selectInvoice(e.target.value)}
            disabled={!customerId}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">{t("credit.installments.selectInvoice")}</option>
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.number} — {formatXOF(inv.totalTTC, inv.currencyCode)}
              </option>
            ))}
          </select>
        </div>

        {selectedInvoice && (
          <>
            <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
              {t("credit.installments.total")}: {formatXOF(selectedInvoice.totalTTC, selectedInvoice.currencyCode)} ·{" "}
              {t("credit.installments.remainingToAllocate")}:{" "}
              <span className={remaining === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                {formatXOF(remaining, selectedInvoice.currencyCode)}
              </span>
            </p>

            <div className="mb-2 space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 sm:w-1/2">
                  <input
                    type="date"
                    value={line.dueDate}
                    onChange={(e) => updateLine(i, { dueDate: e.target.value })}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <input
                    type="number"
                    placeholder={t("credit.installments.amount")}
                    value={line.amount}
                    onChange={(e) => updateLine(i, { amount: e.target.value })}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              ))}
            </div>
            <button onClick={addLine} className="mb-3 text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
              + {t("credit.installments.addLine")}
            </button>

            {formError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{formError}</p>}
            <div>
              <button onClick={handleGenerate} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
                {t("credit.installments.generate")}
              </button>
            </div>
          </>
        )}
      </section>

      {invoiceId && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          {actionError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{actionError}</p>}
          {listError && <p className="text-sm text-red-500 dark:text-red-400">{listError}</p>}
          {!listError && !installments && <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
          {installments && installments.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("credit.installments.noInstallments")}</p>}
          {installments && installments.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="py-2">{t("credit.installments.number")}</th>
                  <th className="py-2">{t("credit.installments.dueDate")}</th>
                  <th className="py-2 text-right">{t("credit.installments.amount")}</th>
                  <th className="py-2">{t("credit.installments.status")}</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {installments.map((ins) => (
                  <tr key={ins.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 text-slate-900 dark:text-white">{ins.installmentNumber}</td>
                    <td className="py-2 text-slate-700 dark:text-slate-300">{formatDate(ins.dueDate)}</td>
                    <td className="py-2 text-right text-slate-700 dark:text-slate-300">{formatXOF(ins.amount, selectedInvoice?.currencyCode)}</td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[ins.status]}`}>
                        {t(`credit.installments.statuses.${ins.status}`)}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      {(ins.status === "PENDING" || ins.status === "OVERDUE") && (
                        <button
                          onClick={() => handleMarkPaid(ins.id)}
                          className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500"
                        >
                          {t("credit.installments.markPaid")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
