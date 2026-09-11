"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, ApiError } from "../../../../lib/api";
import { useI18n } from "../../../../lib/i18n-context";
import { SectionTabs } from "../../../../components/SectionTabs";

interface Permission {
  id: string;
  code: string;
  module: string;
  description: string | null;
}

interface RolePermission {
  permission: Permission;
}

interface Role {
  id: string;
  name: string;
  isSystem: boolean;
  companyId: string | null;
  permissions: RolePermission[];
}

function groupByModule(permissions: Permission[]): Record<string, Permission[]> {
  const groups: Record<string, Permission[]> = {};
  for (const p of permissions) {
    (groups[p.module] ??= []).push(p);
  }
  return groups;
}

function PermissionChecklist({
  groups,
  selected,
  onToggle,
  disabled,
}: {
  groups: Record<string, Permission[]>;
  selected: Set<string>;
  onToggle: (code: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(groups).map(([module, perms]) => (
        <div key={module} className="rounded-lg border border-slate-100 p-2 dark:border-slate-800">
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{module}</p>
          {perms.map((p) => (
            <label key={p.code} className="flex items-start gap-2 py-0.5 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={selected.has(p.code)}
                disabled={disabled}
                onChange={() => onToggle(p.code)}
                className="mt-0.5"
              />
              <span>{p.description ?? p.code}</span>
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function AdminRolesPage() {
  const { t } = useI18n();
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [listError, setListError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [newSelected, setNewSelected] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [editSelected, setEditSelected] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  function loadRoles() {
    apiFetch<Role[]>("/auth/roles")
      .then(setRoles)
      .catch((err) => setListError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  useEffect(() => {
    loadRoles();
    apiFetch<Permission[]>("/auth/roles/permissions").then(setPermissions).catch(() => {});
  }, []);

  const groups = useMemo(() => groupByModule(permissions), [permissions]);
  const selectedRole = roles?.find((r) => r.id === selectedRoleId) ?? null;

  function toggleNew(code: string) {
    setNewSelected((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }

  function toggleEdit(code: string) {
    setEditSelected((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }

  async function handleCreate() {
    setFormError(null);
    if (!name || newSelected.size === 0) {
      setFormError(t("errors.required"));
      return;
    }
    try {
      await apiFetch("/auth/roles", {
        method: "POST",
        body: JSON.stringify({ name, permissionCodes: Array.from(newSelected) }),
      });
      setName("");
      setNewSelected(new Set());
      loadRoles();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  function selectRole(role: Role) {
    setSelectedRoleId(role.id);
    setEditSelected(new Set(role.permissions.map((rp) => rp.permission.code)));
    setActionError(null);
  }

  async function handleSavePermissions() {
    if (!selectedRoleId) return;
    setActionError(null);
    try {
      await apiFetch(`/auth/roles/${selectedRoleId}/permissions`, {
        method: "PATCH",
        body: JSON.stringify({ permissionCodes: Array.from(editSelected) }),
      });
      loadRoles();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function handleDeleteRole(id: string) {
    setActionError(null);
    try {
      await apiFetch(`/auth/roles/${id}`, { method: "DELETE" });
      if (selectedRoleId === id) setSelectedRoleId(null);
      loadRoles();
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
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("admin.roles.new")}</h2>
        <input
          type="text"
          placeholder={t("admin.roles.name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-3 w-full max-w-sm rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
        <div className="mb-3">
          <PermissionChecklist groups={groups} selected={newSelected} onToggle={toggleNew} />
        </div>
        {formError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{formError}</p>}
        <button onClick={handleCreate} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          {t("admin.roles.create")}
        </button>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          {listError && <p className="text-sm text-red-500 dark:text-red-400">{listError}</p>}
          {!listError && !roles && <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
          {roles && roles.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("admin.roles.noRoles")}</p>}
          {roles && roles.length > 0 && (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {roles.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2">
                  <button
                    onClick={() => selectRole(r)}
                    className={`text-left text-sm ${
                      selectedRoleId === r.id ? "font-medium text-indigo-700 dark:text-indigo-300" : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {r.name}
                    {r.isSystem && (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {t("admin.roles.system")}
                      </span>
                    )}
                  </button>
                  {!r.isSystem && (
                    <button
                      onClick={() => handleDeleteRole(r.id)}
                      className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      {t("admin.roles.delete")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          {!selectedRole && <p className="text-sm text-slate-500 dark:text-slate-400">{t("admin.roles.selectRole")}</p>}
          {selectedRole && (
            <>
              <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{selectedRole.name}</h3>
              {actionError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{actionError}</p>}
              <div className="mb-3">
                <PermissionChecklist groups={groups} selected={editSelected} onToggle={toggleEdit} disabled={selectedRole.isSystem} />
              </div>
              {!selectedRole.isSystem && (
                <button onClick={handleSavePermissions} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
                  {t("admin.roles.save")}
                </button>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
