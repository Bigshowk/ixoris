"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../lib/api";
import { useI18n } from "../../../lib/i18n-context";
import { formatXOF } from "../../../lib/format";
import { SectionTabs } from "../../../components/SectionTabs";

interface FiscalYear {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
}

interface TrialBalanceRow {
  accountCode: string;
  label: string;
  class: number;
  totalDebit: number;
  totalCredit: number;
  balance: number;
  balanceSide: "DEBIT" | "CREDIT";
}

interface IncomeStatementLine {
  label: string;
  amount: number;
}

interface IncomeStatement {
  resultatNet: number;
  lines: IncomeStatementLine[];
}

interface BalanceSheetLine {
  label: string;
  amount: number;
}

interface BalanceSheet {
  totalActif: number;
  totalPassif: number;
  balanced: boolean;
  actifLines: BalanceSheetLine[];
  passifLines: BalanceSheetLine[];
}

type ReportView = "trialBalance" | "incomeStatement" | "balanceSheet";

export default function ComptabiliteReportsPage() {
  const { t } = useI18n();
  const [view, setView] = useState<ReportView>("trialBalance");
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[] | null>(null);
  const [fiscalYearId, setFiscalYearId] = useState<string>("");
  const [trialBalance, setTrialBalance] = useState<TrialBalanceRow[] | null>(null);
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatement | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<FiscalYear[]>("/accounting/reports/fiscal-years")
      .then((years) => {
        setFiscalYears(years);
        if (years.length > 0) setFiscalYearId(years[0].id);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : t("errors.networkError")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setError(null);
    if (view === "trialBalance") {
      apiFetch<TrialBalanceRow[]>(`/accounting/reports/trial-balance${fiscalYearId ? `?fiscalYearId=${fiscalYearId}` : ""}`)
        .then(setTrialBalance)
        .catch((err) => setError(err instanceof ApiError ? err.message : t("errors.networkError")));
    } else if (view === "incomeStatement" && fiscalYearId) {
      apiFetch<IncomeStatement>(`/accounting/reports/income-statement?fiscalYearId=${fiscalYearId}`)
        .then(setIncomeStatement)
        .catch((err) => setError(err instanceof ApiError ? err.message : t("errors.networkError")));
    } else if (view === "balanceSheet" && fiscalYearId) {
      apiFetch<BalanceSheet>(`/accounting/reports/balance-sheet?fiscalYearId=${fiscalYearId}`)
        .then(setBalanceSheet)
        .catch((err) => setError(err instanceof ApiError ? err.message : t("errors.networkError")));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, fiscalYearId]);

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

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {(["trialBalance", "incomeStatement", "balanceSheet"] as ReportView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                view === v
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {t(`compta.reports.${v}`)}
            </button>
          ))}
        </div>

        {fiscalYears && fiscalYears.length > 0 && (view === "incomeStatement" || view === "balanceSheet" || view === "trialBalance") && (
          <select
            value={fiscalYearId}
            onChange={(e) => setFiscalYearId(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            {fiscalYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {fiscalYears && fiscalYears.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("compta.reports.noFiscalYear")}</p>
      )}
      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

      {view === "trialBalance" && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="px-4 py-2">{t("compta.reports.account")}</th>
                <th className="px-4 py-2">{t("compta.reports.label")}</th>
                <th className="px-4 py-2 text-right">{t("compta.reports.debit")}</th>
                <th className="px-4 py-2 text-right">{t("compta.reports.credit")}</th>
                <th className="px-4 py-2 text-right">{t("compta.reports.balance")}</th>
              </tr>
            </thead>
            <tbody>
              {(trialBalance ?? []).map((row) => (
                <tr key={row.accountCode} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-2 font-mono text-slate-700 dark:text-slate-300">{row.accountCode}</td>
                  <td className="px-4 py-2 text-slate-900 dark:text-white">{row.label}</td>
                  <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-300">{formatXOF(row.totalDebit)}</td>
                  <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-300">{formatXOF(row.totalCredit)}</td>
                  <td className="px-4 py-2 text-right font-medium text-slate-900 dark:text-white">
                    {formatXOF(row.balance)} {row.balanceSide === "DEBIT" ? "D" : "C"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === "incomeStatement" && incomeStatement && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <tbody>
              {incomeStatement.lines.map((line) => {
                const strong = line.label === line.label.toUpperCase();
                return (
                  <tr key={line.label} className="border-b border-slate-100 dark:border-slate-800">
                    <td className={`px-4 py-2 ${strong ? "font-semibold text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300"}`}>
                      {line.label}
                    </td>
                    <td className={`px-4 py-2 text-right ${strong ? "font-semibold text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300"}`}>
                      {formatXOF(line.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {view === "balanceSheet" && balanceSheet && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            {balanceSheet.actifLines.map((line) => (
              <div key={line.label} className="flex justify-between border-b border-slate-100 py-2 text-sm last:border-0 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-300">{line.label}</span>
                <span className="font-medium text-slate-900 dark:text-white">{formatXOF(line.amount)}</span>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            {balanceSheet.passifLines.map((line) => (
              <div key={line.label} className="flex justify-between border-b border-slate-100 py-2 text-sm last:border-0 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-300">{line.label}</span>
                <span className="font-medium text-slate-900 dark:text-white">{formatXOF(line.amount)}</span>
              </div>
            ))}
          </div>
          <p className={`col-span-full text-sm font-medium ${balanceSheet.balanced ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
            {balanceSheet.balanced ? t("compta.reports.balanced") : t("compta.reports.unbalanced")}
          </p>
        </div>
      )}
    </div>
  );
}
