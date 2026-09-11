"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../../lib/api";
import { useI18n } from "../../../../lib/i18n-context";
import { formatXOF, formatDate } from "../../../../lib/format";
import { SectionTabs } from "../../../../components/SectionTabs";

interface Customer {
  id: string;
  name: string;
  code: string;
}

interface Supplier {
  id: string;
  name: string;
  code: string;
}

interface InvoiceLine {
  label: string;
  quantity: string | number;
  unitPrice: string | number;
  tvaRate: string | number;
}

interface Invoice {
  id: string;
  type: "CUSTOMER" | "SUPPLIER";
  number: string;
  date: string;
  dueDate: string;
  status: string;
  totalTTC: string | number;
  currencyCode: string;
  lines: InvoiceLine[];
}

interface DraftLine {
  label: string;
  quantity: string;
  unitPrice: string;
  tvaRate: string;
}

function emptyLine(): DraftLine {
  return { label: "", quantity: "1", unitPrice: "", tvaRate: "18" };
}

export default function FacturesPage() {
  const { t } = useI18n();
  const [type, setType] = useState<"CUSTOMER" | "SUPPLIER">("CUSTOMER");
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [partyId, setPartyId] = useState("");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function loadInvoices(forType: "CUSTOMER" | "SUPPLIER") {
    apiFetch<Invoice[]>(`/accounting/invoices?type=${forType}`)
      .then(setInvoices)
      .catch((err) => setListError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  useEffect(() => {
    setInvoices(null);
    loadInvoices(type);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  useEffect(() => {
    apiFetch<Customer[]>("/crm/customers").then(setCustomers).catch(() => {});
    apiFetch<Supplier[]>("/accounting/suppliers").then(setSuppliers).catch(() => {});
  }, []);

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  async function handleSubmit() {
    setFormError(null);
    if (!partyId) {
      setFormError(type === "CUSTOMER" ? t("compta.invoices.selectCustomer") : t("compta.invoices.selectSupplier"));
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/accounting/invoices", {
        method: "POST",
        body: JSON.stringify({
          type,
          customerId: type === "CUSTOMER" ? partyId : undefined,
          supplierId: type === "SUPPLIER" ? partyId : undefined,
          dueDate: new Date(dueDate).toISOString(),
          lines: lines
            .filter((l) => l.label && Number(l.unitPrice) > 0)
            .map((l) => ({
              label: l.label,
              quantity: Number(l.quantity) || 1,
              unitPrice: Number(l.unitPrice) || 0,
              tvaRate: Number(l.tvaRate) || 0,
            })),
        }),
      });
      setPartyId("");
      setLines([emptyLine()]);
      loadInvoices(type);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("errors.networkError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleValidate(id: string) {
    try {
      await apiFetch(`/accounting/invoices/${id}/validate`, { method: "POST" });
      loadInvoices(type);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  const parties = type === "CUSTOMER" ? customers : suppliers;

  return (
    <div>
      <SectionTabs
        tabs={[
          { href: "/comptabilite", label: t("compta.tabs.reports") },
          { href: "/comptabilite/ecritures", label: t("compta.tabs.entries") },
          { href: "/comptabilite/factures", label: t("compta.tabs.invoices") },
          { href: "/comptabilite/banque", label: t("compta.tabs.bank") },
        ]}
      />

      <div className="mb-4 flex gap-1">
        <button
          onClick={() => setType("CUSTOMER")}
          className={`rounded-md px-3 py-1.5 text-sm ${
            type === "CUSTOMER" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          {t("compta.invoices.customer")}
        </button>
        <button
          onClick={() => setType("SUPPLIER")}
          className={`rounded-md px-3 py-1.5 text-sm ${
            type === "SUPPLIER" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          {t("compta.invoices.supplier")}
        </button>
      </div>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("compta.invoices.new")}</h2>

        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm text-slate-600 dark:text-slate-300">
            {type === "CUSTOMER" ? t("compta.invoices.customer") : t("compta.invoices.supplier")}
            <select
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">—</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600 dark:text-slate-300">
            {t("compta.invoices.dueDate")}
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </label>
        </div>

        <table className="mb-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500 dark:text-slate-400">
              <th className="py-1">{t("compta.reports.label")}</th>
              <th className="py-1 text-right">{t("compta.invoices.quantity")}</th>
              <th className="py-1 text-right">{t("compta.invoices.unitPrice")}</th>
              <th className="py-1 text-right">{t("compta.invoices.tvaRate")}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i}>
                <td className="py-1 pr-2">
                  <input
                    type="text"
                    value={line.label}
                    onChange={(e) => updateLine(i, { label: e.target.value })}
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </td>
                <td className="py-1 pr-2 text-right">
                  <input
                    type="number"
                    value={line.quantity}
                    onChange={(e) => updateLine(i, { quantity: e.target.value })}
                    className="w-16 rounded-md border border-slate-200 bg-white px-2 py-1 text-right text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </td>
                <td className="py-1 pr-2 text-right">
                  <input
                    type="number"
                    value={line.unitPrice}
                    onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
                    className="w-24 rounded-md border border-slate-200 bg-white px-2 py-1 text-right text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </td>
                <td className="py-1 text-right">
                  <input
                    type="number"
                    value={line.tvaRate}
                    onChange={(e) => updateLine(i, { tvaRate: e.target.value })}
                    className="w-16 rounded-md border border-slate-200 bg-white px-2 py-1 text-right text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          type="button"
          onClick={() => setLines((prev) => [...prev, emptyLine()])}
          className="mb-3 text-xs text-indigo-600 hover:underline dark:text-indigo-400"
        >
          + {t("compta.invoices.addLine")}
        </button>

        {formError && <p className="mb-3 text-sm text-red-500 dark:text-red-400">{formError}</p>}

        <div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {t("compta.invoices.create")}
          </button>
        </div>
      </section>

      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {listError && <p className="p-4 text-sm text-red-500 dark:text-red-400">{listError}</p>}
        {!listError && !invoices && <p className="p-4 text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
        {invoices && invoices.length === 0 && <p className="p-4 text-sm text-slate-500 dark:text-slate-400">{t("compta.invoices.noInvoices")}</p>}
        {invoices && invoices.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="px-4 py-2">Num.</th>
                <th className="px-4 py-2">{t("compta.invoices.dueDate")}</th>
                <th className="px-4 py-2">{t("compta.invoices.status")}</th>
                <th className="px-4 py-2 text-right">{t("compta.invoices.total")}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">{inv.number}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{formatDate(inv.dueDate)}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{inv.status}</td>
                  <td className="px-4 py-2 text-right font-medium text-slate-900 dark:text-white">{formatXOF(inv.totalTTC, inv.currencyCode)}</td>
                  <td className="px-4 py-2 text-right">
                    {inv.status === "DRAFT" && (
                      <button onClick={() => handleValidate(inv.id)} className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">
                        {t("compta.invoices.validate")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
