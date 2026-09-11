"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../../lib/api";
import { useI18n } from "../../../../lib/i18n-context";
import { formatXOF, formatDate } from "../../../../lib/format";
import { SectionTabs } from "../../../../components/SectionTabs";

const JOURNALS = [
  { code: "VE", label: "Ventes" },
  { code: "AC", label: "Achats" },
  { code: "BQ", label: "Banque" },
  { code: "CA", label: "Caisse" },
  { code: "OD", label: "Opérations diverses" },
  { code: "PA", label: "Paie" },
];

interface Account {
  id: string;
  code: string;
  label: string;
}

interface JournalLine {
  id: string;
  accountId: string;
  debit: string | number;
  credit: string | number;
  label: string | null;
  account: Account;
}

interface JournalEntry {
  id: string;
  reference: string;
  date: string;
  description: string | null;
  isPosted: boolean;
  journal: { code: string; label: string };
  lines: JournalLine[];
}

interface DraftLine {
  accountCode: string;
  debit: string;
  credit: string;
  label: string;
}

function emptyLine(): DraftLine {
  return { accountCode: "", debit: "", credit: "", label: "" };
}

export default function EcrituresPage() {
  const { t } = useI18n();
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [listError, setListError] = useState<string | null>(null);

  const [journalCode, setJournalCode] = useState(JOURNALS[0].code);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine(), emptyLine()]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function loadEntries() {
    apiFetch<JournalEntry[]>("/accounting/journal-entries")
      .then(setEntries)
      .catch((err) => setListError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  useEffect(() => {
    loadEntries();
    apiFetch<Account[]>("/accounting/accounts").then(setAccounts).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  async function handleSubmit() {
    setFormError(null);
    if (!balanced) {
      setFormError(t("compta.entries.notBalanced"));
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/accounting/journal-entries", {
        method: "POST",
        body: JSON.stringify({
          journalCode,
          date: new Date(date).toISOString(),
          description: description || undefined,
          lines: lines
            .filter((l) => l.accountCode && (Number(l.debit) > 0 || Number(l.credit) > 0))
            .map((l) => ({
              accountCode: l.accountCode,
              debit: Number(l.debit) || 0,
              credit: Number(l.credit) || 0,
              label: l.label || undefined,
            })),
        }),
      });
      setDescription("");
      setLines([emptyLine(), emptyLine()]);
      loadEntries();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("errors.networkError"));
    } finally {
      setSubmitting(false);
    }
  }

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

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("compta.entries.new")}</h2>

        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-sm text-slate-600 dark:text-slate-300">
            {t("compta.entries.journal")}
            <select
              value={journalCode}
              onChange={(e) => setJournalCode(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              {JOURNALS.map((j) => (
                <option key={j.code} value={j.code}>
                  {j.code} — {j.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600 dark:text-slate-300">
            {t("compta.entries.date")}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </label>
          <label className="text-sm text-slate-600 dark:text-slate-300">
            {t("compta.entries.description")}
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </label>
        </div>

        <table className="mb-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500 dark:text-slate-400">
              <th className="py-1">{t("compta.reports.account")}</th>
              <th className="py-1">{t("compta.reports.label")}</th>
              <th className="py-1 text-right">{t("compta.reports.debit")}</th>
              <th className="py-1 text-right">{t("compta.reports.credit")}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i}>
                <td className="py-1 pr-2">
                  <select
                    value={line.accountCode}
                    onChange={(e) => updateLine(i, { accountCode: e.target.value })}
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">—</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.code}>
                        {a.code} — {a.label}
                      </option>
                    ))}
                  </select>
                </td>
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
                    value={line.debit}
                    onChange={(e) => updateLine(i, { debit: e.target.value, credit: "" })}
                    className="w-24 rounded-md border border-slate-200 bg-white px-2 py-1 text-right text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </td>
                <td className="py-1 text-right">
                  <input
                    type="number"
                    value={line.credit}
                    onChange={(e) => updateLine(i, { credit: e.target.value, debit: "" })}
                    className="w-24 rounded-md border border-slate-200 bg-white px-2 py-1 text-right text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
          + {t("compta.entries.addLine")}
        </button>

        <div className="mb-3 flex gap-6 text-sm">
          <span className="text-slate-600 dark:text-slate-300">
            {t("compta.entries.totalDebit")}: <strong className="text-slate-900 dark:text-white">{formatXOF(totalDebit)}</strong>
          </span>
          <span className="text-slate-600 dark:text-slate-300">
            {t("compta.entries.totalCredit")}: <strong className="text-slate-900 dark:text-white">{formatXOF(totalCredit)}</strong>
          </span>
        </div>

        {formError && <p className="mb-3 text-sm text-red-500 dark:text-red-400">{formError}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!balanced || submitting}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {t("compta.entries.create")}
        </button>
      </section>

      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {listError && <p className="p-4 text-sm text-red-500 dark:text-red-400">{listError}</p>}
        {!listError && !entries && <p className="p-4 text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
        {entries && entries.length === 0 && <p className="p-4 text-sm text-slate-500 dark:text-slate-400">{t("compta.entries.noEntries")}</p>}
        {entries && entries.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="px-4 py-2">{t("compta.entries.reference")}</th>
                <th className="px-4 py-2">{t("compta.entries.date")}</th>
                <th className="px-4 py-2">{t("compta.entries.journal")}</th>
                <th className="px-4 py-2">{t("compta.entries.description")}</th>
                <th className="px-4 py-2 text-right">{t("compta.entries.totalDebit")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const total = entry.lines.reduce((sum, l) => sum + Number(l.debit), 0);
                return (
                  <tr key={entry.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">{entry.reference}</td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{formatDate(entry.date)}</td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{entry.journal.code}</td>
                    <td className="px-4 py-2 text-slate-900 dark:text-white">{entry.description ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-medium text-slate-900 dark:text-white">{formatXOF(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
