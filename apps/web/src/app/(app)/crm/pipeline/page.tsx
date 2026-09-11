"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../../lib/api";
import { useI18n } from "../../../../lib/i18n-context";
import { formatXOF } from "../../../../lib/format";
import { SectionTabs } from "../../../../components/SectionTabs";

const STAGES = ["NEW", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"] as const;
type Stage = (typeof STAGES)[number];

interface Customer {
  id: string;
  name: string;
}

interface Opportunity {
  id: string;
  title: string;
  amount: string | number | null;
  stage: Stage;
  customer: Customer | null;
}

type Board = Record<Stage, Opportunity[]>;

interface DraftOpportunity {
  title: string;
  customerId: string;
  amount: string;
}

export default function PipelinePage() {
  const { t } = useI18n();
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [draft, setDraft] = useState<DraftOpportunity>({ title: "", customerId: "", amount: "" });
  const [formError, setFormError] = useState<string | null>(null);

  function loadBoard() {
    apiFetch<Board>("/crm/opportunities/kanban")
      .then(setBoard)
      .catch((err) => setError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  useEffect(() => {
    loadBoard();
    apiFetch<Customer[]>("/crm/customers").then(setCustomers).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate() {
    setFormError(null);
    if (!draft.title) {
      setFormError(t("errors.required"));
      return;
    }
    try {
      await apiFetch("/crm/opportunities", {
        method: "POST",
        body: JSON.stringify({
          title: draft.title,
          customerId: draft.customerId || undefined,
          amount: Number(draft.amount) || undefined,
        }),
      });
      setDraft({ title: "", customerId: "", amount: "" });
      loadBoard();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function handleMove(id: string, stage: Stage) {
    await apiFetch(`/crm/opportunities/${id}/stage`, { method: "PATCH", body: JSON.stringify({ stage }) }).catch(() => {});
    loadBoard();
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

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("crm.pipeline.new")}</h2>
        <div className="flex flex-wrap items-end gap-2">
          <input
            type="text"
            placeholder={t("crm.pipeline.title")}
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <select
            value={draft.customerId}
            onChange={(e) => setDraft((d) => ({ ...d, customerId: e.target.value }))}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">{t("crm.customers.name")}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder={t("crm.pipeline.amount")}
            value={draft.amount}
            onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <button onClick={handleCreate} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
            {t("crm.pipeline.create")}
          </button>
        </div>
        {formError && <p className="mt-2 text-sm text-red-500 dark:text-red-400">{formError}</p>}
      </section>

      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {STAGES.map((stage) => (
          <div key={stage} className="w-56 shrink-0 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              {stage} ({board?.[stage]?.length ?? 0})
            </h3>
            <div className="space-y-2">
              {(board?.[stage] ?? []).map((opp) => (
                <div key={opp.id} className="rounded-lg border border-slate-100 p-2 text-sm dark:border-slate-800">
                  <p className="font-medium text-slate-900 dark:text-white">{opp.title}</p>
                  {opp.customer && <p className="text-xs text-slate-500 dark:text-slate-400">{opp.customer.name}</p>}
                  {opp.amount != null && <p className="text-xs text-slate-700 dark:text-slate-300">{formatXOF(opp.amount)}</p>}
                  <select
                    value={opp.stage}
                    onChange={(e) => handleMove(opp.id, e.target.value as Stage)}
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-1 py-0.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
