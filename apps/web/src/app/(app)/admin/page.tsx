"use client";

import { useEffect, useState } from "react";
import { PasswordInput } from "@ixoris/ui";
import { apiFetch, ApiError } from "../../../lib/api";
import { useI18n } from "../../../lib/i18n-context";
import { formatDate } from "../../../lib/format";
import { SectionTabs } from "../../../components/SectionTabs";

interface Role {
  id: string;
  name: string;
  isSystem: boolean;
}

interface Store {
  id: string;
  name: string;
  code: string;
}

interface UserRoleAssignment {
  id: string;
  storeId: string | null;
  role: Role;
  store: Store | null;
}

interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  mfaEnabled: boolean;
  mfaRequired: boolean;
  roles: UserRoleAssignment[];
}

interface AssignDraft {
  roleId: string;
  storeId: string;
}

export default function AdminUsersPage() {
  const { t } = useI18n();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [stores, setStores] = useState<Store[]>([]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [roleId, setRoleId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [assignDrafts, setAssignDrafts] = useState<Record<string, AssignDraft>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  function loadUsers() {
    apiFetch<AdminUser[]>("/admin/users")
      .then(setUsers)
      .catch((err) => setListError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  useEffect(() => {
    loadUsers();
    apiFetch<Role[]>("/auth/roles").then(setRoles).catch(() => {});
    apiFetch<{ stores: Store[] }>("/auth/me")
      .then((res) => setStores(res.stores))
      .catch(() => {});
  }, []);

  async function handleCreate() {
    setFormError(null);
    if (!email || !password || !firstName || !lastName || !roleId) {
      setFormError(t("errors.required"));
      return;
    }
    try {
      await apiFetch("/admin/users", {
        method: "POST",
        body: JSON.stringify({ email, password, firstName, lastName, phone: phone || undefined, roleId, storeId: storeId || undefined }),
      });
      setEmail("");
      setPassword("");
      setFirstName("");
      setLastName("");
      setPhone("");
      setRoleId("");
      setStoreId("");
      loadUsers();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function handleToggleActive(user: AdminUser) {
    setActionError(null);
    try {
      await apiFetch(`/admin/users/${user.id}/${user.isActive ? "deactivate" : "activate"}`, { method: "POST" });
      loadUsers();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function handleToggleMfaRequired(user: AdminUser) {
    setActionError(null);
    try {
      await apiFetch(`/admin/users/${user.id}/${user.mfaRequired ? "unrequire-mfa" : "require-mfa"}`, { method: "POST" });
      loadUsers();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  function updateAssignDraft(userId: string, patch: Partial<AssignDraft>) {
    setAssignDrafts((prev) => ({ ...prev, [userId]: { ...(prev[userId] ?? { roleId: "", storeId: "" }), ...patch } }));
  }

  async function handleAssignRole(userId: string) {
    setActionError(null);
    const draft = assignDrafts[userId];
    if (!draft?.roleId) {
      setActionError(t("errors.required"));
      return;
    }
    try {
      await apiFetch(`/admin/users/${userId}/roles`, {
        method: "POST",
        body: JSON.stringify({ roleId: draft.roleId, storeId: draft.storeId || undefined }),
      });
      setAssignDrafts((prev) => ({ ...prev, [userId]: { roleId: "", storeId: "" } }));
      loadUsers();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function handleRevokeRole(userId: string, userRoleId: string) {
    setActionError(null);
    try {
      await apiFetch(`/admin/users/${userId}/roles/${userRoleId}`, { method: "DELETE" });
      loadUsers();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  return (
    <div>
      <SectionTabs
        tabs={[
          { href: "/admin", label: t("admin.tabs.users") },
          { href: "/admin/roles", label: t("admin.tabs.roles") },
        ]}
      />

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("admin.users.new")}</h2>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input
            type="email"
            placeholder={t("admin.users.email")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <PasswordInput
            value={password}
            onChange={setPassword}
            placeholder={t("admin.users.password")}
            autoComplete="new-password"
            inputClassName="rounded-md border border-slate-200 bg-white px-2 py-1.5 pr-9 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            labels={{ show: t("auth.passwordField.show"), hide: t("auth.passwordField.hide") }}
          />
          <input
            type="text"
            placeholder={t("admin.users.firstName")}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <input
            type="text"
            placeholder={t("admin.users.lastName")}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <input
            type="text"
            placeholder={t("admin.users.phone")}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">{t("admin.users.role")}</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">{t("admin.users.allStores")}</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        {formError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{formError}</p>}
        <button onClick={handleCreate} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          {t("admin.users.create")}
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        {actionError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{actionError}</p>}
        {listError && <p className="text-sm text-red-500 dark:text-red-400">{listError}</p>}
        {!listError && !users && <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
        {users && users.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("admin.users.noUsers")}</p>}
        {users && users.length > 0 && (
          <div className="space-y-3">
            {users.map((u) => {
              const draft = assignDrafts[u.id] ?? { roleId: "", storeId: "" };
              return (
                <div key={u.id} className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {u.firstName} {u.lastName} <span className="text-xs text-slate-500 dark:text-slate-400">({u.email})</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.isActive
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500"
                        }`}
                      >
                        {u.isActive ? t("admin.users.active") : t("admin.users.inactive")}
                      </span>
                      <button
                        onClick={() => handleToggleActive(u)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        {u.isActive ? t("admin.users.deactivate") : t("admin.users.activate")}
                      </button>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.mfaEnabled
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500"
                        }`}
                      >
                        {u.mfaEnabled ? t("admin.users.mfaEnabled") : t("admin.users.mfaDisabled")}
                        {u.mfaRequired ? ` · ${t("admin.users.mfaRequired")}` : ""}
                      </span>
                      <button
                        onClick={() => handleToggleMfaRequired(u)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        {u.mfaRequired ? t("admin.users.unrequireMfa") : t("admin.users.requireMfa")}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {u.lastLoginAt ? `${t("admin.users.lastLogin")}: ${formatDate(u.lastLoginAt)}` : t("admin.users.never")}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {u.roles.map((ur) => (
                      <span
                        key={ur.id}
                        className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                      >
                        {ur.role.name}
                        {ur.store ? ` (${ur.store.name})` : ""}
                        <button onClick={() => handleRevokeRole(u.id, ur.id)} className="ml-1 text-indigo-400 hover:text-red-500">
                          ×
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:items-center">
                    <select
                      value={draft.roleId}
                      onChange={(e) => updateAssignDraft(u.id, { roleId: e.target.value })}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="">{t("admin.users.assignRole")}</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={draft.storeId}
                      onChange={(e) => updateAssignDraft(u.id, { storeId: e.target.value })}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="">{t("admin.users.allStores")}</option>
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleAssignRole(u.id)}
                      className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
                    >
                      {t("admin.users.assign")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
