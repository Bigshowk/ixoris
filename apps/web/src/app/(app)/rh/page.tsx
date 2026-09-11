"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../lib/api";
import { useI18n } from "../../../lib/i18n-context";
import { formatXOF } from "../../../lib/format";
import { SectionTabs } from "../../../components/SectionTabs";

interface Department {
  id: string;
  name: string;
}

interface Position {
  id: string;
  title: string;
}

interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  hireDate: string;
  baseSalary: string | number;
  status: "ACTIVE" | "ON_LEAVE" | "TERMINATED";
  department: Department | null;
  position: Position | null;
}

export default function RhEmployeesPage() {
  const { t } = useI18n();
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);

  const [employeeNumber, setEmployeeNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [hireDate, setHireDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [baseSalary, setBaseSalary] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [newPositionTitle, setNewPositionTitle] = useState("");

  function loadEmployees() {
    apiFetch<Employee[]>("/hr/employees")
      .then(setEmployees)
      .catch((err) => setListError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  function loadDepartments() {
    apiFetch<Department[]>("/hr/departments").then(setDepartments).catch(() => {});
  }

  function loadPositions() {
    apiFetch<Position[]>("/hr/positions").then(setPositions).catch(() => {});
  }

  useEffect(() => {
    loadEmployees();
    loadDepartments();
    loadPositions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateEmployee() {
    setFormError(null);
    try {
      await apiFetch("/hr/employees", {
        method: "POST",
        body: JSON.stringify({
          employeeNumber,
          firstName,
          lastName,
          hireDate: new Date(hireDate).toISOString(),
          baseSalary: Number(baseSalary) || 0,
          departmentId: departmentId || undefined,
          positionId: positionId || undefined,
        }),
      });
      setEmployeeNumber("");
      setFirstName("");
      setLastName("");
      setBaseSalary("");
      loadEmployees();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function handleTerminate(id: string) {
    try {
      await apiFetch(`/hr/employees/${id}/terminate`, {
        method: "POST",
        body: JSON.stringify({ terminationDate: new Date().toISOString() }),
      });
      loadEmployees();
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function handleAddDepartment() {
    if (!newDepartmentName) return;
    await apiFetch("/hr/departments", { method: "POST", body: JSON.stringify({ name: newDepartmentName }) }).catch(() => {});
    setNewDepartmentName("");
    loadDepartments();
  }

  async function handleAddPosition() {
    if (!newPositionTitle) return;
    await apiFetch("/hr/positions", { method: "POST", body: JSON.stringify({ title: newPositionTitle }) }).catch(() => {});
    setNewPositionTitle("");
    loadPositions();
  }

  return (
    <div>
      <SectionTabs
        tabs={[
          { href: "/rh", label: t("rh.tabs.employees") },
          { href: "/rh/conges", label: t("rh.tabs.leave") },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("rh.employees.new")}</h2>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <input
              type="text"
              placeholder={t("rh.employees.employeeNumber")}
              value={employeeNumber}
              onChange={(e) => setEmployeeNumber(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <input
              type="text"
              placeholder={t("rh.employees.firstName")}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <input
              type="text"
              placeholder={t("rh.employees.lastName")}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <label className="text-xs text-slate-500 dark:text-slate-400">
              {t("rh.employees.hireDate")}
              <input
                type="date"
                value={hireDate}
                onChange={(e) => setHireDate(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </label>
            <input
              type="number"
              placeholder={t("rh.employees.baseSalary")}
              value={baseSalary}
              onChange={(e) => setBaseSalary(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">{t("rh.employees.department")}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select
              value={positionId}
              onChange={(e) => setPositionId(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">{t("rh.employees.position")}</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          {formError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{formError}</p>}
          <button
            onClick={handleCreateEmployee}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            {t("rh.employees.create")}
          </button>

          <div className="mt-6 overflow-x-auto">
            {listError && <p className="text-sm text-red-500 dark:text-red-400">{listError}</p>}
            {!listError && !employees && <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
            {employees && employees.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("rh.employees.noEmployees")}</p>}
            {employees && employees.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="py-2">{t("rh.employees.employeeNumber")}</th>
                    <th className="py-2">{t("compta.reports.label")}</th>
                    <th className="py-2">{t("rh.employees.department")}</th>
                    <th className="py-2 text-right">{t("rh.employees.baseSalary")}</th>
                    <th className="py-2">{t("rh.employees.status")}</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2 font-mono text-xs text-slate-700 dark:text-slate-300">{emp.employeeNumber}</td>
                      <td className="py-2 text-slate-900 dark:text-white">
                        {emp.firstName} {emp.lastName}
                      </td>
                      <td className="py-2 text-slate-700 dark:text-slate-300">{emp.department?.name ?? "—"}</td>
                      <td className="py-2 text-right text-slate-700 dark:text-slate-300">{formatXOF(emp.baseSalary)}</td>
                      <td className="py-2 text-slate-700 dark:text-slate-300">{emp.status}</td>
                      <td className="py-2 text-right">
                        {emp.status === "ACTIVE" && (
                          <button onClick={() => handleTerminate(emp.id)} className="text-xs text-red-500 hover:underline">
                            {t("rh.employees.terminate")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{t("rh.employees.newDepartment")}</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newDepartmentName}
                onChange={(e) => setNewDepartmentName(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <button onClick={handleAddDepartment} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500">
                {t("rh.employees.add")}
              </button>
            </div>
            <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
              {departments.map((d) => (
                <li key={d.id}>{d.name}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{t("rh.employees.newPosition")}</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newPositionTitle}
                onChange={(e) => setNewPositionTitle(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <button onClick={handleAddPosition} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500">
                {t("rh.employees.add")}
              </button>
            </div>
            <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
              {positions.map((p) => (
                <li key={p.id}>{p.title}</li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
