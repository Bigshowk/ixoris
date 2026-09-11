"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "../../../../lib/api";
import { useI18n } from "../../../../lib/i18n-context";
import { SectionTabs } from "../../../../components/SectionTabs";

interface ReorderResult {
  checked: number;
  lowStock: number;
  ordersCreated: number;
  notificationsCreated: number;
}

export default function AchatsReorderPage() {
  const { t } = useI18n();
  const [result, setResult] = useState<ReorderResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setRunning(true);
    setError(null);
    try {
      const res = await apiFetch<ReorderResult>("/supply-chain/reorder-check/run", { method: "POST" });
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("errors.networkError"));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <SectionTabs
        tabs={[
          { href: "/achats", label: t("achats.tabs.quotes") },
          { href: "/achats/commandes", label: t("achats.tabs.orders") },
          { href: "/achats/receptions", label: t("achats.tabs.receipts") },
          { href: "/achats/reappro", label: t("achats.tabs.reorder") },
        ]}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <button
          onClick={handleRun}
          disabled={running}
          className="mb-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {t("achats.reorder.run")}
        </button>

        {error && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{error}</p>}

        {result && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
              <p className="text-xs uppercase text-slate-500 dark:text-slate-400">{t("achats.reorder.checked")}</p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">{result.checked}</p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
              <p className="text-xs uppercase text-slate-500 dark:text-slate-400">{t("achats.reorder.lowStock")}</p>
              <p className="text-2xl font-semibold text-amber-600 dark:text-amber-400">{result.lowStock}</p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
              <p className="text-xs uppercase text-slate-500 dark:text-slate-400">{t("achats.reorder.ordersCreated")}</p>
              <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">{result.ordersCreated}</p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
              <p className="text-xs uppercase text-slate-500 dark:text-slate-400">{t("achats.reorder.notificationsCreated")}</p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">{result.notificationsCreated}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
