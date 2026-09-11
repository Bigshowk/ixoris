"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../../lib/api";
import { useI18n } from "../../../../lib/i18n-context";
import { formatXOF, formatDate } from "../../../../lib/format";
import { SectionTabs } from "../../../../components/SectionTabs";

type ApprovableType = "PURCHASE_ORDER" | "EXPENSE";
type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";

interface Role {
  id: string;
  name: string;
}

interface ApprovalRule {
  id: string;
  appliesTo: ApprovableType;
  minAmount: string | number;
  requiredRole: Role;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
}

interface ApprovalRequest {
  id: string;
  type: ApprovableType;
  targetId: string;
  amount: string | number;
  status: RequestStatus;
  comment: string | null;
  createdAt: string;
  requestedBy: User;
  decidedBy: User | null;
}

const APPROVABLE_TYPES: ApprovableType[] = ["PURCHASE_ORDER", "EXPENSE"];

const STATUS_STYLES: Record<RequestStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

export default function DocumentsApprovalsPage() {
  const { t } = useI18n();
  const [rules, setRules] = useState<ApprovalRule[] | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [rulesError, setRulesError] = useState<string | null>(null);

  const [appliesTo, setAppliesTo] = useState<ApprovableType>("PURCHASE_ORDER");
  const [minAmount, setMinAmount] = useState("");
  const [requiredRoleId, setRequiredRoleId] = useState("");
  const [ruleFormError, setRuleFormError] = useState<string | null>(null);

  const [requests, setRequests] = useState<ApprovalRequest[] | null>(null);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<RequestStatus>("PENDING");
  const [comment, setComment] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  function loadRules() {
    apiFetch<ApprovalRule[]>("/approvals/rules")
      .then(setRules)
      .catch((err) => setRulesError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  function loadRequests(status: RequestStatus) {
    apiFetch<ApprovalRequest[]>(`/approvals/requests?status=${status}`)
      .then(setRequests)
      .catch((err) => setRequestsError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  useEffect(() => {
    loadRules();
    apiFetch<Role[]>("/auth/roles").then(setRoles).catch(() => {});
    loadRequests(statusFilter);
  }, []);

  function changeStatusFilter(status: RequestStatus) {
    setStatusFilter(status);
    setRequests(null);
    loadRequests(status);
  }

  async function handleCreateRule() {
    setRuleFormError(null);
    if (!minAmount || !requiredRoleId) {
      setRuleFormError(t("errors.required"));
      return;
    }
    try {
      await apiFetch("/approvals/rules", {
        method: "POST",
        body: JSON.stringify({ appliesTo, minAmount: Number(minAmount), requiredRoleId }),
      });
      setMinAmount("");
      setRequiredRoleId("");
      loadRules();
    } catch (err) {
      setRuleFormError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function handleDeleteRule(id: string) {
    setRulesError(null);
    try {
      await apiFetch(`/approvals/rules/${id}`, { method: "DELETE" });
      loadRules();
    } catch (err) {
      setRulesError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function handleDecide(id: string, decision: "APPROVED" | "REJECTED") {
    setActionError(null);
    try {
      await apiFetch(`/approvals/requests/${id}/decide`, {
        method: "POST",
        body: JSON.stringify({ decision, comment: comment[id] || undefined }),
      });
      loadRequests(statusFilter);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  return (
    <div>
      <SectionTabs
        tabs={[
          { href: "/documents", label: t("documents.tabs.library") },
          { href: "/documents/approbations", label: t("documents.tabs.approvals") },
        ]}
      />

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("documents.approvals.newRule")}</h2>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <select
            value={appliesTo}
            onChange={(e) => setAppliesTo(e.target.value as ApprovableType)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            {APPROVABLE_TYPES.map((tp) => (
              <option key={tp} value={tp}>
                {t(`documents.approvals.types.${tp}`)}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder={t("documents.approvals.minAmount")}
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <select
            value={requiredRoleId}
            onChange={(e) => setRequiredRoleId(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">{t("documents.approvals.requiredRole")}</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        {ruleFormError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{ruleFormError}</p>}
        <button onClick={handleCreateRule} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          {t("documents.approvals.create")}
        </button>
      </section>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{t("documents.approvals.rules")}</h3>
        {rulesError && <p className="text-sm text-red-500 dark:text-red-400">{rulesError}</p>}
        {!rulesError && !rules && <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
        {rules && rules.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("documents.approvals.noRules")}</p>}
        {rules && rules.length > 0 && (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {rules.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-700 dark:text-slate-300">
                  {t(`documents.approvals.types.${r.appliesTo}`)} ≥ {formatXOF(r.minAmount)} → {r.requiredRole.name}
                </span>
                <button
                  onClick={() => handleDeleteRule(r.id)}
                  className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  {t("documents.approvals.delete")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex gap-1 border-b border-slate-200 dark:border-slate-800">
          {(["PENDING", "APPROVED", "REJECTED"] as RequestStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => changeStatusFilter(s)}
              className={`border-b-2 px-3 py-2 text-sm ${
                statusFilter === s
                  ? "border-indigo-600 font-medium text-indigo-700 dark:border-indigo-400 dark:text-indigo-300"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              {t(`documents.approvals.statuses.${s}`)}
            </button>
          ))}
        </div>

        {actionError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{actionError}</p>}
        {requestsError && <p className="text-sm text-red-500 dark:text-red-400">{requestsError}</p>}
        {!requestsError && !requests && <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
        {requests && requests.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("documents.approvals.noRequests")}</p>}
        {requests && requests.length > 0 && (
          <div className="space-y-3">
            {requests.map((req) => (
              <div key={req.id} className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {t(`documents.approvals.types.${req.type}`)} — {formatXOF(req.amount)}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[req.status]}`}>
                    {t(`documents.approvals.statuses.${req.status}`)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("documents.approvals.requestedBy")}: {req.requestedBy.firstName} {req.requestedBy.lastName} · {formatDate(req.createdAt)}
                  {req.decidedBy && (
                    <>
                      {" "}
                      · {t("documents.approvals.decidedBy")}: {req.decidedBy.firstName} {req.decidedBy.lastName}
                    </>
                  )}
                  {req.comment && <> · {req.comment}</>}
                </p>

                {req.status === "PENDING" && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      placeholder={t("documents.approvals.comment")}
                      value={comment[req.id] ?? ""}
                      onChange={(e) => setComment((prev) => ({ ...prev, [req.id]: e.target.value }))}
                      className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                    <button
                      onClick={() => handleDecide(req.id, "APPROVED")}
                      className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
                    >
                      {t("documents.approvals.approve")}
                    </button>
                    <button
                      onClick={() => handleDecide(req.id, "REJECTED")}
                      className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      {t("documents.approvals.reject")}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
