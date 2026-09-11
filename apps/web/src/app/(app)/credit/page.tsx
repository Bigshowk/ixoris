"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../lib/api";
import { useI18n } from "../../../lib/i18n-context";
import { formatXOF } from "../../../lib/format";
import { SectionTabs } from "../../../components/SectionTabs";

interface Customer {
  id: string;
  code: string;
  name: string;
  creditLimit: string | number;
  isBlocked: boolean;
  blockedReason: string | null;
}

interface OverdueCheckResult {
  checked: number;
  blocked: number;
  installmentsMarkedOverdue: number;
}

export default function CreditCustomersPage() {
  const { t } = useI18n();
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [outstanding, setOutstanding] = useState<number | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const [checkResult, setCheckResult] = useState<OverdueCheckResult | null>(null);
  const [checking, setChecking] = useState(false);

  function loadCustomers() {
    apiFetch<Customer[]>("/crm/customers")
      .then(setCustomers)
      .catch((err) => setListError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  function selectCustomer(id: string) {
    setSelectedId(id);
    setOutstanding(null);
    setActionError(null);
    apiFetch<{ customerId: string; outstanding: number }>(`/credit-control/customers/${id}/outstanding`)
      .then((res) => setOutstanding(res.outstanding))
      .catch((err) => setActionError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  async function handleBlock() {
    if (!selectedId || !blockReason) {
      setActionError(t("errors.required"));
      return;
    }
    setActionError(null);
    try {
      await apiFetch(`/credit-control/customers/${selectedId}/block`, {
        method: "POST",
        body: JSON.stringify({ reason: blockReason }),
      });
      setBlockReason("");
      loadCustomers();
      selectCustomer(selectedId);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function handleUnblock() {
    if (!selectedId) return;
    setActionError(null);
    try {
      await apiFetch(`/credit-control/customers/${selectedId}/unblock`, { method: "POST" });
      loadCustomers();
      selectCustomer(selectedId);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function handleRunOverdueCheck() {
    setChecking(true);
    setActionError(null);
    try {
      const res = await apiFetch<OverdueCheckResult>("/credit-control/run-overdue-check", { method: "POST" });
      setCheckResult(res);
      loadCustomers();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("errors.networkError"));
    } finally {
      setChecking(false);
    }
  }

  const selectedCustomer = customers?.find((c) => c.id === selectedId) ?? null;

  return (
    <div>
      <SectionTabs
        tabs={[
          { href: "/credit", label: t("credit.tabs.customers") },
          { href: "/credit/echeanciers", label: t("credit.tabs.installments") },
        ]}
      />

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <button
          onClick={handleRunOverdueCheck}
          disabled={checking}
          className="mb-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {t("credit.customers.runOverdueCheck")}
        </button>
        {checkResult && (
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
              <p className="text-xs uppercase text-slate-500 dark:text-slate-400">{t("credit.customers.checked")}</p>
              <p className="text-xl font-semibold text-slate-900 dark:text-white">{checkResult.checked}</p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
              <p className="text-xs uppercase text-slate-500 dark:text-slate-400">{t("credit.customers.blockedCount")}</p>
              <p className="text-xl font-semibold text-red-600 dark:text-red-400">{checkResult.blocked}</p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
              <p className="text-xs uppercase text-slate-500 dark:text-slate-400">{t("credit.customers.installmentsMarkedOverdue")}</p>
              <p className="text-xl font-semibold text-amber-600 dark:text-amber-400">{checkResult.installmentsMarkedOverdue}</p>
            </div>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          {listError && <p className="text-sm text-red-500 dark:text-red-400">{listError}</p>}
          {!listError && !customers && <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
          {customers && customers.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("credit.customers.noCustomers")}</p>}
          {customers && customers.length > 0 && (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {customers.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => selectCustomer(c.id)}
                    className={`flex w-full items-center justify-between py-2 text-left text-sm ${
                      selectedId === c.id ? "font-medium text-indigo-700 dark:text-indigo-300" : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <span>
                      {c.code} — {c.name}
                    </span>
                    {c.isBlocked && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                        {t("credit.customers.blocked")}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          {!selectedCustomer && <p className="text-sm text-slate-500 dark:text-slate-400">{t("credit.customers.selectCustomer")}</p>}
          {selectedCustomer && (
            <>
              <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{selectedCustomer.name}</h3>
              <div className="mb-4 grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                  <p className="text-xs uppercase text-slate-500 dark:text-slate-400">{t("credit.customers.creditLimit")}</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">{formatXOF(selectedCustomer.creditLimit)}</p>
                </div>
                <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                  <p className="text-xs uppercase text-slate-500 dark:text-slate-400">{t("credit.customers.outstanding")}</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {outstanding === null ? t("common.loading") : formatXOF(outstanding)}
                  </p>
                </div>
              </div>

              {selectedCustomer.isBlocked && (
                <p className="mb-3 text-sm text-red-600 dark:text-red-400">
                  {t("credit.customers.blocked")} — {selectedCustomer.blockedReason}
                </p>
              )}

              {actionError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{actionError}</p>}

              {selectedCustomer.isBlocked ? (
                <button onClick={handleUnblock} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
                  {t("credit.customers.unblock")}
                </button>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={t("credit.customers.blockReason")}
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <button
                    onClick={handleBlock}
                    className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    {t("credit.customers.block")}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
