"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../../lib/api";
import { useI18n } from "../../../../lib/i18n-context";
import { formatDate } from "../../../../lib/format";
import { SectionTabs } from "../../../../components/SectionTabs";

interface Reminder {
  id: string;
  type: string;
  channel: string;
  status: string;
  scheduledAt: string;
  targetType: string;
}

export default function RelancesPage() {
  const { t } = useI18n();
  const [reminders, setReminders] = useState<Reminder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  function loadReminders() {
    apiFetch<Reminder[]>("/crm/reminders")
      .then(setReminders)
      .catch((err) => setError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  useEffect(() => {
    loadReminders();
  }, []);

  async function handleGenerate() {
    setActionMessage(null);
    try {
      const result = await apiFetch<{ generated: number }>("/crm/reminders/generate-overdue", { method: "POST" });
      setActionMessage(`+${result.generated}`);
      loadReminders();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function handleDispatch() {
    setActionMessage(null);
    try {
      const result = await apiFetch<{ sent: number; failed: number }>("/crm/reminders/dispatch", { method: "POST" });
      setActionMessage(`${result.sent} / ${result.failed}`);
      loadReminders();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
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

      <div className="mb-4 flex items-center gap-2">
        <button onClick={handleGenerate} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          {t("crm.reminders.generate")}
        </button>
        <button onClick={handleDispatch} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
          {t("crm.reminders.dispatch")}
        </button>
        {actionMessage && <span className="text-sm text-slate-500 dark:text-slate-400">{actionMessage}</span>}
      </div>

      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {error && <p className="p-4 text-sm text-red-500 dark:text-red-400">{error}</p>}
        {!error && !reminders && <p className="p-4 text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
        {reminders && reminders.length === 0 && <p className="p-4 text-sm text-slate-500 dark:text-slate-400">{t("crm.reminders.noReminders")}</p>}
        {reminders && reminders.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="px-4 py-2">{t("crm.reminders.channel")}</th>
                <th className="px-4 py-2">{t("crm.reminders.scheduledAt")}</th>
                <th className="px-4 py-2">{t("crm.reminders.status")}</th>
              </tr>
            </thead>
            <tbody>
              {reminders.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{r.channel}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{formatDate(r.scheduledAt)}</td>
                  <td className="px-4 py-2 text-slate-900 dark:text-white">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
