"use client";

import { useEffect, useState } from "react";
import { apiFetch, apiFetchBlob, openBlob, ApiError } from "../../../lib/api";
import { useI18n } from "../../../lib/i18n-context";
import { formatXOF } from "../../../lib/format";

interface PayslipLine {
  label: string;
  amount: string | number;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
}

interface Payslip {
  id: string;
  grossSalary: string | number;
  totalDeductions: string | number;
  netSalary: string | number;
  employee: Employee;
  lines: PayslipLine[];
}

interface PayrollRun {
  id: string;
  period: string;
  status: "DRAFT" | "VALIDATED" | "PAID";
  payslips: Payslip[];
}

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
}

interface TransferBatch {
  id: string;
}

export default function PaiePage() {
  const { t } = useI18n();
  const [runs, setRuns] = useState<PayrollRun[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);

  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankAccountId, setBankAccountId] = useState("");
  const [transferBatch, setTransferBatch] = useState<TransferBatch | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);

  function loadRuns() {
    apiFetch<PayrollRun[]>("/payroll/runs")
      .then(setRuns)
      .catch((err) => setListError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  useEffect(() => {
    loadRuns();
    apiFetch<BankAccount[]>("/accounting/bank-accounts")
      .then((accs) => {
        setBankAccounts(accs);
        if (accs.length > 0) setBankAccountId(accs[0].id);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateRun() {
    setFormError(null);
    setSubmitting(true);
    try {
      await apiFetch("/payroll/runs", { method: "POST", body: JSON.stringify({ period }) });
      loadRuns();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("errors.networkError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function openRun(run: PayrollRun) {
    setSelectedRun(run);
    setTransferBatch(null);
    setTransferError(null);
  }

  async function handleValidate() {
    if (!selectedRun) return;
    try {
      const updated = await apiFetch<PayrollRun>(`/payroll/runs/${selectedRun.id}/validate`, { method: "POST" });
      setSelectedRun(updated);
      loadRuns();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function handleGenerateTransfer() {
    if (!selectedRun) return;
    setTransferError(null);
    try {
      const batch = await apiFetch<TransferBatch>(`/payroll/runs/${selectedRun.id}/bank-transfer`, {
        method: "POST",
        body: JSON.stringify({ bankAccountId: bankAccountId || undefined }),
      });
      setTransferBatch(batch);
    } catch (err) {
      setTransferError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function handleDownloadCsv() {
    if (!transferBatch) return;
    const blob = await apiFetchBlob(`/payroll/bank-transfers/${transferBatch.id}/csv`);
    openBlob(blob);
  }

  async function handleDownloadPdf(payslipId: string) {
    const blob = await apiFetchBlob(`/payroll/payslips/${payslipId}/pdf`);
    openBlob(blob);
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900 dark:text-white">{t("nav.payroll")}</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("paie.newRun")}</h2>
          <div className="mb-3 flex items-end gap-2">
            <label className="text-sm text-slate-600 dark:text-slate-300">
              {t("paie.period")}
              <input
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="mt-1 block rounded-md border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </label>
            <button
              onClick={handleCreateRun}
              disabled={submitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {t("paie.create")}
            </button>
          </div>
          {formError && <p className="text-sm text-red-500 dark:text-red-400">{formError}</p>}

          {listError && <p className="text-sm text-red-500 dark:text-red-400">{listError}</p>}
          {!listError && !runs && <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
          {runs && runs.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("paie.noRuns")}</p>}
          <ul className="mt-2 space-y-1">
            {(runs ?? []).map((run) => {
              const netTotal = run.payslips.reduce((sum, p) => sum + Number(p.netSalary), 0);
              return (
                <li key={run.id}>
                  <button
                    onClick={() => openRun(run)}
                    className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ${
                      selectedRun?.id === run.id
                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span>
                      {run.period} — {run.status}
                    </span>
                    <span className="font-medium">{formatXOF(netTotal)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          {!selectedRun && <p className="text-sm text-slate-500 dark:text-slate-400">—</p>}
          {selectedRun && (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t("paie.payslips")} — {selectedRun.period}
                </h2>
                {selectedRun.status === "DRAFT" && (
                  <button onClick={handleValidate} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500">
                    {t("paie.validate")}
                  </button>
                )}
              </div>

              <table className="mb-4 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500 dark:text-slate-400">
                    <th className="py-1">{t("paie.employee")}</th>
                    <th className="py-1 text-right">{t("paie.gross")}</th>
                    <th className="py-1 text-right">{t("paie.deductions")}</th>
                    <th className="py-1 text-right">{t("paie.net")}</th>
                    <th className="py-1" />
                  </tr>
                </thead>
                <tbody>
                  {selectedRun.payslips.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-1.5 text-slate-900 dark:text-white">
                        {p.employee.firstName} {p.employee.lastName}
                      </td>
                      <td className="py-1.5 text-right text-slate-700 dark:text-slate-300">{formatXOF(p.grossSalary)}</td>
                      <td className="py-1.5 text-right text-slate-700 dark:text-slate-300">{formatXOF(p.totalDeductions)}</td>
                      <td className="py-1.5 text-right font-medium text-slate-900 dark:text-white">{formatXOF(p.netSalary)}</td>
                      <td className="py-1.5 text-right">
                        <button onClick={() => handleDownloadPdf(p.id)} className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">
                          {t("paie.pdf")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {selectedRun.status !== "DRAFT" && (
                <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                  <p className="mb-2 text-xs text-emerald-600 dark:text-emerald-400">{t("paie.validated")}</p>
                  {!transferBatch && (
                    <div className="flex items-end gap-2">
                      {bankAccounts.length > 0 && (
                        <select
                          value={bankAccountId}
                          onChange={(e) => setBankAccountId(e.target.value)}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        >
                          {bankAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.bankName} — {acc.accountNumber}
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        onClick={handleGenerateTransfer}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
                      >
                        {t("paie.generateTransfer")}
                      </button>
                    </div>
                  )}
                  {transferError && <p className="mt-2 text-sm text-red-500 dark:text-red-400">{transferError}</p>}
                  {transferBatch && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-sm text-emerald-600 dark:text-emerald-400">{t("paie.transferGenerated")}</span>
                      <button onClick={handleDownloadCsv} className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">
                        {t("paie.downloadCsv")}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
