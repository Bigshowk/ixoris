"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../lib/api";
import { useI18n } from "../../../lib/i18n-context";
import { formatXOF } from "../../../lib/format";

interface CrmAnalytics {
  totalCustomers: number;
  categoryBreakdown: { VIP: number; REGULAR: number; LATE_PAYER: number; NEW: number };
  activeCustomers90d: number;
  retentionRate: number;
  topCustomers: { customer: { id: string; name: string } | null; totalSpent: number; orderCount: number }[];
  overdueCustomersCount: number;
}

interface ApprovalRequest {
  id: string;
  type: "PURCHASE_ORDER" | "EXPENSE";
  amount: string | number;
  status: string;
  createdAt: string;
}

const REFRESH_MS = 30_000;

export default function DashboardPage() {
  const { t } = useI18n();
  const [analytics, setAnalytics] = useState<CrmAnalytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[] | null>(null);
  const [approvalsError, setApprovalsError] = useState<string | null>(null);

  useEffect(() => {
    function loadAnalytics() {
      apiFetch<CrmAnalytics>("/crm/analytics")
        .then((res) => {
          setAnalytics(res);
          setAnalyticsError(null);
        })
        .catch((err) => setAnalyticsError(err instanceof ApiError ? err.message : t("errors.networkError")));
    }

    function loadApprovals() {
      apiFetch<ApprovalRequest[]>("/approvals/requests?status=PENDING")
        .then((res) => {
          setPendingApprovals(res);
          setApprovalsError(null);
        })
        .catch((err) => setApprovalsError(err instanceof ApiError ? err.message : t("errors.networkError")));
    }

    loadAnalytics();
    loadApprovals();
    // Live-ish dashboard: re-pull both panels on an interval instead of a single fetch-on-mount.
    const interval = setInterval(() => {
      loadAnalytics();
      loadApprovals();
    }, REFRESH_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{t("nav.dashboard")}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label={t("dashboard.totalCustomers")} value={analytics?.totalCustomers} error={analyticsError} />
        <StatCard label={t("dashboard.vipCustomers")} value={analytics?.categoryBreakdown.VIP} error={analyticsError} />
        <StatCard label={t("dashboard.retentionRate")} value={analytics ? `${analytics.retentionRate}%` : undefined} error={analyticsError} />
        <StatCard label={t("dashboard.pendingApprovals")} value={pendingApprovals?.length} error={approvalsError} />
        <StatCard label={t("dashboard.overdueCustomers")} value={analytics?.overdueCustomersCount} error={analyticsError} alert={(analytics?.overdueCustomersCount ?? 0) > 0} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("dashboard.topCustomers")}</h2>
          {analyticsError && <p className="text-sm text-red-500 dark:text-red-400">{analyticsError}</p>}
          {!analyticsError && !analytics && <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
          {analytics && analytics.topCustomers.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">—</p>
          )}
          {analytics && analytics.topCustomers.length > 0 && (
            <table className="w-full text-sm">
              <tbody>
                {analytics.topCustomers.map((row, i) => (
                  <tr key={row.customer?.id ?? i} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-2 text-slate-900 dark:text-white">{row.customer?.name ?? "—"}</td>
                    <td className="py-2 text-right text-slate-500 dark:text-slate-400">{row.orderCount}</td>
                    <td className="py-2 text-right font-medium text-slate-900 dark:text-white">{formatXOF(row.totalSpent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("dashboard.pendingApprovals")}</h2>
          {approvalsError && <p className="text-sm text-red-500 dark:text-red-400">{approvalsError}</p>}
          {!approvalsError && !pendingApprovals && <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
          {pendingApprovals && pendingApprovals.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t("dashboard.noPendingApprovals")}</p>
          )}
          {pendingApprovals && pendingApprovals.length > 0 && (
            <ul className="space-y-2">
              {pendingApprovals.map((req) => (
                <li key={req.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 dark:text-slate-300">
                    {req.type === "PURCHASE_ORDER" ? t("dashboard.purchaseOrder") : t("dashboard.expense")}
                  </span>
                  <span className="font-medium text-slate-900 dark:text-white">{formatXOF(req.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  error,
  alert = false,
}: {
  label: string;
  value: string | number | undefined;
  error: string | null;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        alert
          ? "border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30"
          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      }`}
    >
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${alert ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-white"}`}>
        {error ? "—" : (value ?? "…")}
      </p>
    </div>
  );
}
