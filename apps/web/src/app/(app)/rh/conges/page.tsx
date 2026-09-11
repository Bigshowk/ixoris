"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../../lib/api";
import { useI18n } from "../../../../lib/i18n-context";
import { formatDate } from "../../../../lib/format";
import { SectionTabs } from "../../../../components/SectionTabs";

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
}

interface LeaveType {
  id: string;
  name: string;
  isPaid: boolean;
}

interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  employee: Employee;
  leaveType: LeaveType;
}

const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LATE", "HALF_DAY"] as const;

export default function CongesPage() {
  const { t } = useI18n();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [pending, setPending] = useState<LeaveRequest[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [newTypeName, setNewTypeName] = useState("");
  const [newTypePaid, setNewTypePaid] = useState(true);

  const [reqEmployeeId, setReqEmployeeId] = useState("");
  const [reqLeaveTypeId, setReqLeaveTypeId] = useState("");
  const [reqStart, setReqStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [reqEnd, setReqEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [reqError, setReqError] = useState<string | null>(null);

  const [attEmployeeId, setAttEmployeeId] = useState("");
  const [attDate, setAttDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [attStatus, setAttStatus] = useState<(typeof ATTENDANCE_STATUSES)[number]>("PRESENT");
  const [attError, setAttError] = useState<string | null>(null);
  const [attSuccess, setAttSuccess] = useState(false);

  function loadPending() {
    apiFetch<LeaveRequest[]>("/hr/leave-requests/pending")
      .then(setPending)
      .catch((err) => setListError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  function loadLeaveTypes() {
    apiFetch<LeaveType[]>("/hr/leave-types").then(setLeaveTypes).catch(() => {});
  }

  useEffect(() => {
    apiFetch<Employee[]>("/hr/employees").then(setEmployees).catch(() => {});
    loadLeaveTypes();
    loadPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAddType() {
    if (!newTypeName) return;
    await apiFetch("/hr/leave-types", { method: "POST", body: JSON.stringify({ name: newTypeName, isPaid: newTypePaid }) }).catch(() => {});
    setNewTypeName("");
    loadLeaveTypes();
  }

  async function handleCreateRequest() {
    setReqError(null);
    if (!reqEmployeeId || !reqLeaveTypeId) {
      setReqError(t("errors.required"));
      return;
    }
    try {
      await apiFetch("/hr/leave-requests", {
        method: "POST",
        body: JSON.stringify({
          employeeId: reqEmployeeId,
          leaveTypeId: reqLeaveTypeId,
          startDate: new Date(reqStart).toISOString(),
          endDate: new Date(reqEnd).toISOString(),
        }),
      });
      loadPending();
    } catch (err) {
      setReqError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function handleDecide(id: string, decision: "approve" | "reject") {
    try {
      await apiFetch(`/hr/leave-requests/${id}/${decision}`, { method: "POST" });
      loadPending();
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function handleRecordAttendance() {
    setAttError(null);
    setAttSuccess(false);
    if (!attEmployeeId) {
      setAttError(t("errors.required"));
      return;
    }
    try {
      await apiFetch("/hr/attendance", {
        method: "POST",
        body: JSON.stringify({ employeeId: attEmployeeId, date: new Date(attDate).toISOString(), status: attStatus }),
      });
      setAttSuccess(true);
    } catch (err) {
      setAttError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  return (
    <div>
      <SectionTabs
        tabs={[
          { href: "/rh", label: t("rh.tabs.employees") },
          { href: "/rh/conges", label: t("rh.tabs.leave") },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("rh.leave.types")}</h2>
          <div className="mb-3 flex items-center gap-2">
            <input
              type="text"
              placeholder={t("rh.leave.newType")}
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={newTypePaid} onChange={(e) => setNewTypePaid(e.target.checked)} />
              {t("rh.leave.isPaid")}
            </label>
            <button onClick={handleAddType} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500">
              {t("rh.employees.add")}
            </button>
          </div>
          <ul className="mb-6 space-y-1 text-sm text-slate-600 dark:text-slate-300">
            {leaveTypes.map((lt) => (
              <li key={lt.id}>
                {lt.name} {lt.isPaid ? `(${t("rh.leave.isPaid")})` : ""}
              </li>
            ))}
          </ul>

          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("rh.leave.newRequest")}</h2>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <select
              value={reqEmployeeId}
              onChange={(e) => setReqEmployeeId(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">{t("rh.leave.employee")}</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName}
                </option>
              ))}
            </select>
            <select
              value={reqLeaveTypeId}
              onChange={(e) => setReqLeaveTypeId(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">{t("rh.leave.leaveType")}</option>
              {leaveTypes.map((lt) => (
                <option key={lt.id} value={lt.id}>
                  {lt.name}
                </option>
              ))}
            </select>
            <label className="text-xs text-slate-500 dark:text-slate-400">
              {t("rh.leave.startDate")}
              <input
                type="date"
                value={reqStart}
                onChange={(e) => setReqStart(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </label>
            <label className="text-xs text-slate-500 dark:text-slate-400">
              {t("rh.leave.endDate")}
              <input
                type="date"
                value={reqEnd}
                onChange={(e) => setReqEnd(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </label>
          </div>
          {reqError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{reqError}</p>}
          <button onClick={handleCreateRequest} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
            {t("rh.leave.create")}
          </button>
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("rh.leave.requests")}</h2>
            {listError && <p className="text-sm text-red-500 dark:text-red-400">{listError}</p>}
            {pending && pending.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("rh.leave.noPending")}</p>}
            <ul className="space-y-2">
              {(pending ?? []).map((req) => (
                <li key={req.id} className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm dark:border-slate-800">
                  <span className="text-slate-700 dark:text-slate-300">
                    {req.employee.firstName} {req.employee.lastName} — {req.leaveType.name} ({formatDate(req.startDate)} → {formatDate(req.endDate)})
                  </span>
                  <span className="flex gap-2">
                    <button onClick={() => handleDecide(req.id, "approve")} className="text-xs text-emerald-600 hover:underline dark:text-emerald-400">
                      {t("rh.leave.approve")}
                    </button>
                    <button onClick={() => handleDecide(req.id, "reject")} className="text-xs text-red-500 hover:underline">
                      {t("rh.leave.reject")}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("rh.leave.recordAttendance")}</h2>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <select
                value={attEmployeeId}
                onChange={(e) => setAttEmployeeId(e.target.value)}
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">{t("rh.leave.employee")}</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={attDate}
                onChange={(e) => setAttDate(e.target.value)}
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <select
                value={attStatus}
                onChange={(e) => setAttStatus(e.target.value as (typeof ATTENDANCE_STATUSES)[number])}
                className="col-span-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {ATTENDANCE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            {attError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{attError}</p>}
            {attSuccess && <p className="mb-2 text-sm text-emerald-600 dark:text-emerald-400">✓</p>}
            <button onClick={handleRecordAttendance} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
              {t("rh.leave.record")}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
