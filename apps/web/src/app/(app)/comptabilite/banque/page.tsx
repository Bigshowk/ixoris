"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../../lib/api";
import { useI18n } from "../../../../lib/i18n-context";
import { formatXOF, formatDate } from "../../../../lib/format";
import { SectionTabs } from "../../../../components/SectionTabs";

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  currencyCode: string;
}

interface StatementLine {
  id: string;
  date: string;
  label: string;
  amount: string | number;
  isReconciled: boolean;
}

interface BankStatement {
  id: string;
  statementDate: string;
  startBalance: string | number;
  endBalance: string | number;
  lines: StatementLine[];
}

interface StatementSummary {
  totalLines: number;
  reconciledLines: number;
  unreconciledLines: number;
  unreconciledAmount: number;
  statementNetMovement: number;
}

export default function BanquePage() {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<BankAccount[] | null>(null);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [glAccountCode, setGlAccountCode] = useState("");
  const [accountFormError, setAccountFormError] = useState<string | null>(null);

  const [statements, setStatements] = useState<BankStatement[] | null>(null);
  const [selectedStatement, setSelectedStatement] = useState<BankStatement | null>(null);
  const [summary, setSummary] = useState<StatementSummary | null>(null);

  const [statementDate, setStatementDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startBalance, setStartBalance] = useState("");
  const [endBalance, setEndBalance] = useState("");
  const [csv, setCsv] = useState("date;label;montant\n");
  const [importError, setImportError] = useState<string | null>(null);

  function loadAccounts() {
    apiFetch<BankAccount[]>("/accounting/bank-accounts")
      .then((list) => {
        setAccounts(list);
        if (list.length > 0 && !selectedAccountId) setSelectedAccountId(list[0].id);
      })
      .catch((err) => setAccountsError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  /** Refetches the statement list only — does not touch the currently open statement/summary. */
  function refreshStatementsList(accountId: string) {
    apiFetch<BankStatement[]>(`/accounting/bank-statements?bankAccountId=${accountId}`)
      .then(setStatements)
      .catch(() => setStatements([]));
  }

  function loadStatements(accountId: string) {
    setSelectedStatement(null);
    setSummary(null);
    refreshStatementsList(accountId);
  }

  useEffect(() => {
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedAccountId) loadStatements(selectedAccountId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId]);

  async function handleCreateAccount() {
    setAccountFormError(null);
    try {
      await apiFetch("/accounting/bank-accounts", {
        method: "POST",
        body: JSON.stringify({ bankName, accountNumber, glAccountCode }),
      });
      setBankName("");
      setAccountNumber("");
      setGlAccountCode("");
      loadAccounts();
    } catch (err) {
      setAccountFormError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function handleImport() {
    if (!selectedAccountId) return;
    setImportError(null);
    try {
      await apiFetch("/accounting/bank-statements/import", {
        method: "POST",
        body: JSON.stringify({
          bankAccountId: selectedAccountId,
          statementDate: new Date(statementDate).toISOString(),
          startBalance: Number(startBalance) || 0,
          endBalance: Number(endBalance) || 0,
          csv,
        }),
      });
      setStartBalance("");
      setEndBalance("");
      setCsv("date;label;montant\n");
      refreshStatementsList(selectedAccountId);
    } catch (err) {
      setImportError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function openStatement(statement: BankStatement) {
    setSelectedStatement(statement);
    apiFetch<StatementSummary>(`/accounting/bank-statements/${statement.id}/summary`)
      .then(setSummary)
      .catch(() => setSummary(null));
  }

  async function handleAutoMatch() {
    if (!selectedStatement) return;
    await apiFetch(`/accounting/bank-statements/${selectedStatement.id}/auto-match`, { method: "POST" }).catch(() => {});
    const refreshed = await apiFetch<BankStatement>(`/accounting/bank-statements/${selectedStatement.id}`);
    setSelectedStatement(refreshed);
    apiFetch<StatementSummary>(`/accounting/bank-statements/${refreshed.id}/summary`).then(setSummary).catch(() => {});
    if (selectedAccountId) refreshStatementsList(selectedAccountId);
  }

  const selectedAccount = accounts?.find((a) => a.id === selectedAccountId) ?? null;

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("compta.bank.accounts")}</h2>
          {accountsError && <p className="text-sm text-red-500 dark:text-red-400">{accountsError}</p>}
          {accounts && accounts.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("compta.bank.noAccounts")}</p>}
          <ul className="mb-4 space-y-1">
            {(accounts ?? []).map((acc) => (
              <li key={acc.id}>
                <button
                  onClick={() => setSelectedAccountId(acc.id)}
                  className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                    selectedAccountId === acc.id
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {acc.bankName} — {acc.accountNumber}
                </button>
              </li>
            ))}
          </ul>

          <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{t("compta.bank.newAccount")}</h3>
          <div className="space-y-2">
            <input
              type="text"
              placeholder={t("compta.bank.bankName")}
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <input
              type="text"
              placeholder={t("compta.bank.accountNumber")}
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <input
              type="text"
              placeholder={t("compta.bank.glAccountCode")}
              value={glAccountCode}
              onChange={(e) => setGlAccountCode(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            {accountFormError && <p className="text-xs text-red-500 dark:text-red-400">{accountFormError}</p>}
            <button
              onClick={handleCreateAccount}
              className="w-full rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
            >
              {t("common.save")}
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("compta.bank.statements")}</h2>
          {statements && statements.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("compta.bank.noStatements")}</p>}
          <ul className="mb-4 space-y-1">
            {(statements ?? []).map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => openStatement(s)}
                  className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                    selectedStatement?.id === s.id
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {formatDate(s.statementDate)} — {formatXOF(s.endBalance, selectedAccount?.currencyCode)}
                </button>
              </li>
            ))}
          </ul>

          <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{t("compta.bank.importStatement")}</h3>
          <div className="space-y-2">
            <input
              type="date"
              value={statementDate}
              onChange={(e) => setStatementDate(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <div className="flex gap-2">
              <input
                type="number"
                placeholder={t("compta.bank.startBalance")}
                value={startBalance}
                onChange={(e) => setStartBalance(e.target.value)}
                className="w-1/2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <input
                type="number"
                placeholder={t("compta.bank.endBalance")}
                value={endBalance}
                onChange={(e) => setEndBalance(e.target.value)}
                className="w-1/2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <p className="text-xs text-slate-400 dark:text-slate-500">{t("compta.bank.csvHelp")}</p>
            {importError && <p className="text-xs text-red-500 dark:text-red-400">{importError}</p>}
            <button
              onClick={handleImport}
              disabled={!selectedAccountId}
              className="w-full rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {t("compta.bank.import")}
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          {!selectedStatement && <p className="text-sm text-slate-500 dark:text-slate-400">—</p>}
          {selectedStatement && (
            <>
              {summary && (
                <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">{t("compta.bank.matched")}: </span>
                    <span className="font-medium text-slate-900 dark:text-white">{summary.reconciledLines}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">{t("compta.bank.unmatched")}: </span>
                    <span className="font-medium text-slate-900 dark:text-white">{summary.unreconciledLines}</span>
                  </div>
                </div>
              )}
              <button
                onClick={handleAutoMatch}
                className="mb-3 w-full rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
              >
                {t("compta.bank.autoMatch")}
              </button>
              <ul className="space-y-1 text-sm">
                {selectedStatement.lines.map((line) => (
                  <li key={line.id} className="flex items-center justify-between border-b border-slate-100 py-1 dark:border-slate-800">
                    <span className="text-slate-700 dark:text-slate-300">
                      {formatDate(line.date)} — {line.label}
                    </span>
                    <span className={`font-medium ${line.isReconciled ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white"}`}>
                      {formatXOF(line.amount, selectedAccount?.currencyCode)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
