"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../../lib/api";
import { useI18n } from "../../../../lib/i18n-context";
import { SectionTabs } from "../../../../components/SectionTabs";

interface Vehicle {
  id: string;
  plateNumber: string;
  type: string;
  capacityKg: string | number | null;
}

const VEHICLE_TYPES = ["MOTO", "CAR", "VAN", "TRUCK"] as const;

export default function LogistiqueVehiclesPage() {
  const { t } = useI18n();
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [plateNumber, setPlateNumber] = useState("");
  const [type, setType] = useState<(typeof VEHICLE_TYPES)[number]>("MOTO");
  const [capacityKg, setCapacityKg] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  function loadVehicles() {
    apiFetch<Vehicle[]>("/logistics/vehicles")
      .then(setVehicles)
      .catch((err) => setListError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  useEffect(() => {
    loadVehicles();
  }, []);

  async function handleCreate() {
    setFormError(null);
    if (!plateNumber) {
      setFormError(t("errors.required"));
      return;
    }
    try {
      await apiFetch("/logistics/vehicles", {
        method: "POST",
        body: JSON.stringify({ plateNumber, type, capacityKg: capacityKg ? Number(capacityKg) : undefined }),
      });
      setPlateNumber("");
      setCapacityKg("");
      loadVehicles();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("errors.networkError"));
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
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("logistique.vehicles.new")}</h2>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <input
            type="text"
            placeholder={t("logistique.vehicles.plateNumber")}
            value={plateNumber}
            onChange={(e) => setPlateNumber(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as (typeof VEHICLE_TYPES)[number])}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            {VEHICLE_TYPES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder={t("logistique.vehicles.capacityKg")}
            value={capacityKg}
            onChange={(e) => setCapacityKg(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        {formError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{formError}</p>}
        <button onClick={handleCreate} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          {t("logistique.vehicles.create")}
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        {listError && <p className="text-sm text-red-500 dark:text-red-400">{listError}</p>}
        {!listError && !vehicles && <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
        {vehicles && vehicles.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("logistique.vehicles.noVehicles")}</p>}
        {vehicles && vehicles.length > 0 && (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {vehicles.map((v) => (
              <li key={v.id} className="py-2 text-sm">
                <span className="font-medium text-slate-900 dark:text-white">{v.plateNumber}</span>
                <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{v.type}</span>
                {v.capacityKg && <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{Number(v.capacityKg)} kg</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
