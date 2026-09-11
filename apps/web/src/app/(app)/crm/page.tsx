"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../lib/api";
import { useI18n } from "../../../lib/i18n-context";
import { formatXOF, formatDate } from "../../../lib/format";
import { SectionTabs } from "../../../components/SectionTabs";

interface Customer {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  category: "VIP" | "REGULAR" | "LATE_PAYER" | "NEW";
  creditLimit: string | number;
  isBlocked: boolean;
  blockedReason: string | null;
}

interface CustomerAnalytics {
  totalSpent: number;
  orderCount: number;
  overdueInvoiceCount: number;
  overdueTotal: number;
}

interface Interaction {
  id: string;
  type: string;
  notes: string;
  date: string;
}

const CATEGORY_STYLE: Record<Customer["category"], string> = {
  VIP: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  REGULAR: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  LATE_PAYER: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300",
  NEW: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300",
};

export default function CrmCustomersPage() {
  const { t } = useI18n();
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [analytics, setAnalytics] = useState<CustomerAnalytics | null>(null);
  const [interactions, setInteractions] = useState<Interaction[] | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [interactionType, setInteractionType] = useState("CALL");
  const [interactionNotes, setInteractionNotes] = useState("");

  function loadCustomers() {
    apiFetch<Customer[]>("/crm/customers")
      .then(setCustomers)
      .catch((err) => setListError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  async function handleCreate() {
    setFormError(null);
    try {
      await apiFetch("/crm/customers", {
        method: "POST",
        body: JSON.stringify({ code, name, email: email || undefined, phone: phone || undefined, creditLimit: Number(creditLimit) || 0 }),
      });
      setCode("");
      setName("");
      setEmail("");
      setPhone("");
      setCreditLimit("");
      loadCustomers();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function openCustomer(customer: Customer) {
    setSelected(customer);
    apiFetch<CustomerAnalytics>(`/crm/customers/${customer.id}/analytics`).then(setAnalytics).catch(() => setAnalytics(null));
    apiFetch<Interaction[]>(`/crm/interactions?customerId=${customer.id}`).then(setInteractions).catch(() => setInteractions([]));
  }

  async function handleAddInteraction() {
    if (!selected || !interactionNotes) return;
    await apiFetch("/crm/interactions", {
      method: "POST",
      body: JSON.stringify({ customerId: selected.id, type: interactionType, notes: interactionNotes }),
    }).catch(() => {});
    setInteractionNotes("");
    apiFetch<Interaction[]>(`/crm/interactions?customerId=${selected.id}`).then(setInteractions).catch(() => {});
  }

  return (
    <div>
      <SectionTabs
        tabs={[
          { href: "/crm", label: t("crm.tabs.customers") },
          { href: "/crm/pipeline", label: t("crm.tabs.pipeline") },
          { href: "/crm/relances", label: t("crm.tabs.reminders") },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("crm.customers.new")}</h2>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <input
              type="text"
              placeholder={t("crm.customers.code")}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <input
              type="text"
              placeholder={t("crm.customers.name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <input
              type="email"
              placeholder={t("crm.customers.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <input
              type="text"
              placeholder={t("crm.customers.phone")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <input
              type="number"
              placeholder={t("crm.customers.creditLimit")}
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          {formError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{formError}</p>}
          <button onClick={handleCreate} className="mb-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
            {t("crm.customers.create")}
          </button>

          {listError && <p className="text-sm text-red-500 dark:text-red-400">{listError}</p>}
          {!listError && !customers && <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
          {customers && customers.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("crm.customers.noCustomers")}</p>}
          <ul className="space-y-1">
            {(customers ?? []).map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => openCustomer(c)}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm ${
                    selected?.id === c.id
                      ? "bg-indigo-50 dark:bg-indigo-500/10"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-slate-900 dark:text-white">{c.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${CATEGORY_STYLE[c.category]}`}>{c.category}</span>
                    {c.isBlocked && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
                        {t("crm.customers.blocked")}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-slate-400">{c.code}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          {!selected && <p className="text-sm text-slate-500 dark:text-slate-400">—</p>}
          {selected && (
            <>
              <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">{selected.name}</h2>
              {selected.isBlocked && selected.blockedReason && (
                <p className="mb-3 text-xs text-red-500 dark:text-red-400">{selected.blockedReason}</p>
              )}

              {analytics && (
                <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">{t("crm.customers.totalSpent")}: </span>
                    <span className="font-medium text-slate-900 dark:text-white">{formatXOF(analytics.totalSpent)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">{t("crm.customers.orderCount")}: </span>
                    <span className="font-medium text-slate-900 dark:text-white">{analytics.orderCount}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 dark:text-slate-400">{t("crm.customers.overdueInvoices")}: </span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {analytics.overdueInvoiceCount} ({formatXOF(analytics.overdueTotal)})
                    </span>
                  </div>
                </div>
              )}

              <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{t("crm.customers.interactions")}</h3>
              <ul className="mb-3 max-h-48 space-y-1 overflow-y-auto text-sm">
                {(interactions ?? []).map((i) => (
                  <li key={i.id} className="border-b border-slate-100 pb-1 dark:border-slate-800">
                    <span className="text-xs text-slate-400">{formatDate(i.date)} · {i.type}</span>
                    <p className="text-slate-700 dark:text-slate-300">{i.notes}</p>
                  </li>
                ))}
              </ul>

              <div className="space-y-2">
                <select
                  value={interactionType}
                  onChange={(e) => setInteractionType(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {["CALL", "EMAIL", "MEETING", "WHATSAPP", "SMS", "NOTE"].map((ty) => (
                    <option key={ty} value={ty}>
                      {ty}
                    </option>
                  ))}
                </select>
                <textarea
                  value={interactionNotes}
                  onChange={(e) => setInteractionNotes(e.target.value)}
                  placeholder={t("crm.customers.notes")}
                  rows={2}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <button
                  onClick={handleAddInteraction}
                  className="w-full rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  {t("crm.customers.add")}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
