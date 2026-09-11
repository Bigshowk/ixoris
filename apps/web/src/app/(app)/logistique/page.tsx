"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../lib/api";
import { useI18n } from "../../../lib/i18n-context";
import { formatXOF, formatDate } from "../../../lib/format";
import { SectionTabs } from "../../../components/SectionTabs";

interface Zone {
  id: string;
  name: string;
}

interface Vehicle {
  id: string;
  plateNumber: string;
}

interface Driver {
  id: string;
  firstName: string;
  lastName: string;
}

interface Customer {
  id: string;
  name: string;
}

type DeliveryStatus = "PENDING" | "LOADED" | "IN_TRANSIT" | "DELIVERED" | "FAILED" | "CANCELLED";

interface Delivery {
  id: string;
  number: string;
  status: DeliveryStatus;
  address: string;
  feeAmount: string | number;
  scheduledAt: string | null;
  customer: Customer | null;
  zone: Zone | null;
  vehicle: Vehicle | null;
  driver: Driver | null;
}

const STATUS_STYLES: Record<DeliveryStatus, string> = {
  PENDING: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  LOADED: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  IN_TRANSIT: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  DELIVERED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  FAILED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const NEXT_STATUSES: Record<DeliveryStatus, DeliveryStatus[]> = {
  PENDING: ["LOADED", "CANCELLED"],
  LOADED: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["FAILED", "CANCELLED"],
  DELIVERED: [],
  FAILED: [],
  CANCELLED: [],
};

interface AssignDraft {
  driverId: string;
  vehicleId: string;
}

interface StatusDraft {
  status: DeliveryStatus | "";
  notes: string;
  lostValue: string;
}

export default function LogistiqueDeliveriesPage() {
  const { t } = useI18n();
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  const [address, setAddress] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [assignDrafts, setAssignDrafts] = useState<Record<string, AssignDraft>>({});
  const [statusDrafts, setStatusDrafts] = useState<Record<string, StatusDraft>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  function loadDeliveries() {
    apiFetch<Delivery[]>("/logistics/deliveries")
      .then(setDeliveries)
      .catch((err) => setListError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  useEffect(() => {
    loadDeliveries();
    apiFetch<Zone[]>("/logistics/zones").then(setZones).catch(() => {});
    apiFetch<Vehicle[]>("/logistics/vehicles").then(setVehicles).catch(() => {});
    apiFetch<Driver[]>("/logistics/drivers").then(setDrivers).catch(() => {});
  }, []);

  async function handleCreate() {
    setFormError(null);
    if (!address) {
      setFormError(t("errors.required"));
      return;
    }
    try {
      await apiFetch("/logistics/deliveries", {
        method: "POST",
        body: JSON.stringify({
          address,
          deliveryZoneId: zoneId || undefined,
          vehicleId: vehicleId || undefined,
          driverId: driverId || undefined,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
          weightKg: weightKg ? Number(weightKg) : undefined,
          distanceKm: distanceKm ? Number(distanceKm) : undefined,
        }),
      });
      setAddress("");
      setZoneId("");
      setVehicleId("");
      setDriverId("");
      setScheduledAt("");
      setWeightKg("");
      setDistanceKm("");
      loadDeliveries();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  function updateAssignDraft(id: string, patch: Partial<AssignDraft>) {
    setAssignDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { driverId: "", vehicleId: "" }), ...patch } }));
  }

  function updateStatusDraft(id: string, patch: Partial<StatusDraft>) {
    setStatusDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { status: "", notes: "", lostValue: "" }), ...patch } }));
  }

  async function handleAssign(id: string) {
    setActionError(null);
    const draft = assignDrafts[id];
    if (!draft?.driverId) {
      setActionError(t("errors.required"));
      return;
    }
    try {
      await apiFetch(`/logistics/deliveries/${id}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ driverId: draft.driverId, vehicleId: draft.vehicleId || undefined }),
      });
      loadDeliveries();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function handleStatusChange(id: string) {
    setActionError(null);
    const draft = statusDrafts[id];
    if (!draft?.status) {
      setActionError(t("errors.required"));
      return;
    }
    try {
      await apiFetch(`/logistics/deliveries/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: draft.status,
          notes: draft.notes || undefined,
          lostValue: draft.status === "FAILED" && draft.lostValue ? Number(draft.lostValue) : undefined,
        }),
      });
      loadDeliveries();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  return (
    <div>
      <SectionTabs
        tabs={[
          { href: "/logistique", label: t("logistique.tabs.deliveries") },
          { href: "/logistique/zones", label: t("logistique.tabs.zones") },
          { href: "/logistique/vehicules", label: t("logistique.tabs.vehicles") },
          { href: "/logistique/suivi", label: t("logistique.tabs.tracking") },
        ]}
      />

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("logistique.deliveries.new")}</h2>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <input
            type="text"
            placeholder={t("logistique.deliveries.address")}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm sm:col-span-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <select
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">{t("logistique.deliveries.zone")}</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
          <select
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">{t("logistique.deliveries.vehicle")}</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plateNumber}
              </option>
            ))}
          </select>
          <select
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">{t("logistique.deliveries.driver")}</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.firstName} {d.lastName}
              </option>
            ))}
          </select>
          <input
            type="date"
            title={t("logistique.deliveries.scheduledAt")}
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <input
            type="number"
            placeholder={t("logistique.deliveries.weightKg")}
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <input
            type="number"
            placeholder={t("logistique.deliveries.distanceKm")}
            value={distanceKm}
            onChange={(e) => setDistanceKm(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        {formError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{formError}</p>}
        <button onClick={handleCreate} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          {t("logistique.deliveries.create")}
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        {actionError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{actionError}</p>}
        {listError && <p className="text-sm text-red-500 dark:text-red-400">{listError}</p>}
        {!listError && !deliveries && <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
        {deliveries && deliveries.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("logistique.deliveries.noDeliveries")}</p>}
        {deliveries && deliveries.length > 0 && (
          <div className="space-y-3">
            {deliveries.map((d) => {
              const nextStatuses = NEXT_STATUSES[d.status];
              const assignDraft = assignDrafts[d.id] ?? { driverId: "", vehicleId: "" };
              const statusDraft = statusDrafts[d.id] ?? { status: "" as const, notes: "", lostValue: "" };
              return (
                <div key={d.id} className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {d.number} — {d.address}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[d.status]}`}>
                      {t(`delivery.status.${d.status}`)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {d.customer ? `${d.customer.name} · ` : ""}
                    {d.zone ? `${d.zone.name} · ` : ""}
                    {d.driver ? `${d.driver.firstName} ${d.driver.lastName}` : t("logistique.deliveries.unassigned")}
                    {d.vehicle ? ` (${d.vehicle.plateNumber})` : ""} · {formatXOF(d.feeAmount)}
                    {d.scheduledAt ? ` · ${formatDate(d.scheduledAt)}` : ""}
                  </p>

                  {d.status === "PENDING" && (
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:items-center">
                      <select
                        value={assignDraft.driverId}
                        onChange={(e) => updateAssignDraft(d.id, { driverId: e.target.value })}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        <option value="">{t("logistique.deliveries.driver")}</option>
                        {drivers.map((dr) => (
                          <option key={dr.id} value={dr.id}>
                            {dr.firstName} {dr.lastName}
                          </option>
                        ))}
                      </select>
                      <select
                        value={assignDraft.vehicleId}
                        onChange={(e) => updateAssignDraft(d.id, { vehicleId: e.target.value })}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        <option value="">{t("logistique.deliveries.vehicle")}</option>
                        {vehicles.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.plateNumber}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleAssign(d.id)}
                        className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
                      >
                        {t("logistique.deliveries.assign")}
                      </button>
                    </div>
                  )}

                  {nextStatuses.length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:items-center">
                      <select
                        value={statusDraft.status}
                        onChange={(e) => updateStatusDraft(d.id, { status: e.target.value as DeliveryStatus })}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        <option value="">{t("logistique.deliveries.status")}</option>
                        {nextStatuses.map((s) => (
                          <option key={s} value={s}>
                            {t(`delivery.status.${s}`)}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder={t("logistique.deliveries.notes")}
                        value={statusDraft.notes}
                        onChange={(e) => updateStatusDraft(d.id, { notes: e.target.value })}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                      {statusDraft.status === "FAILED" && (
                        <input
                          type="number"
                          placeholder={t("logistique.deliveries.lostValue")}
                          value={statusDraft.lostValue}
                          onChange={(e) => updateStatusDraft(d.id, { lostValue: e.target.value })}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      )}
                      <button
                        onClick={() => handleStatusChange(d.id)}
                        className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
                      >
                        {t("logistique.deliveries.updateStatus")}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
