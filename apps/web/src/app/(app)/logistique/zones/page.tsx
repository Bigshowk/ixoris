"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../../lib/api";
import { useI18n } from "../../../../lib/i18n-context";
import { formatXOF } from "../../../../lib/format";
import { SectionTabs } from "../../../../components/SectionTabs";

interface Zone {
  id: string;
  name: string;
  description: string | null;
  feeFlat: string | number;
  feePerKm: string | number;
  feePerKg: string | number;
  estimatedDurationMinutes: number | null;
}

export default function LogistiqueZonesPage() {
  const { t } = useI18n();
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [feeFlat, setFeeFlat] = useState("");
  const [feePerKm, setFeePerKm] = useState("");
  const [feePerKg, setFeePerKg] = useState("");
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  function loadZones() {
    apiFetch<Zone[]>("/logistics/zones")
      .then(setZones)
      .catch((err) => setListError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  useEffect(() => {
    loadZones();
  }, []);

  async function handleCreate() {
    setFormError(null);
    if (!name) {
      setFormError(t("errors.required"));
      return;
    }
    try {
      await apiFetch("/logistics/zones", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: description || undefined,
          feeFlat: feeFlat ? Number(feeFlat) : undefined,
          feePerKm: feePerKm ? Number(feePerKm) : undefined,
          feePerKg: feePerKg ? Number(feePerKg) : undefined,
          estimatedDurationMinutes: estimatedDurationMinutes ? Number(estimatedDurationMinutes) : undefined,
        }),
      });
      setName("");
      setDescription("");
      setFeeFlat("");
      setFeePerKm("");
      setFeePerKg("");
      setEstimatedDurationMinutes("");
      loadZones();
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
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("logistique.zones.new")}</h2>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <input
            type="text"
            placeholder={t("logistique.zones.name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <input
            type="text"
            placeholder={t("logistique.zones.description")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <input
            type="number"
            placeholder={t("logistique.zones.feeFlat")}
            value={feeFlat}
            onChange={(e) => setFeeFlat(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <input
            type="number"
            placeholder={t("logistique.zones.feePerKm")}
            value={feePerKm}
            onChange={(e) => setFeePerKm(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <input
            type="number"
            placeholder={t("logistique.zones.feePerKg")}
            value={feePerKg}
            onChange={(e) => setFeePerKg(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <input
            type="number"
            placeholder={t("logistique.zones.estimatedDurationMinutes")}
            value={estimatedDurationMinutes}
            onChange={(e) => setEstimatedDurationMinutes(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        {formError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{formError}</p>}
        <button onClick={handleCreate} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          {t("logistique.zones.create")}
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        {listError && <p className="text-sm text-red-500 dark:text-red-400">{listError}</p>}
        {!listError && !zones && <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
        {zones && zones.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("logistique.zones.noZones")}</p>}
        {zones && zones.length > 0 && (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {zones.map((z) => (
              <li key={z.id} className="py-2 text-sm">
                <span className="font-medium text-slate-900 dark:text-white">{z.name}</span>
                {z.description && <span className="ml-2 text-slate-500 dark:text-slate-400">{z.description}</span>}
                <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                  {formatXOF(z.feeFlat)}
                  {Number(z.feePerKm) > 0 && ` + ${formatXOF(z.feePerKm)}/km`}
                  {Number(z.feePerKg) > 0 && ` + ${formatXOF(z.feePerKg)}/kg`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
