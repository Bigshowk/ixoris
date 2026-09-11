"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../../lib/api";
import { useI18n } from "../../../../lib/i18n-context";
import { SectionTabs } from "../../../../components/SectionTabs";

interface Warehouse {
  id: string;
  name: string;
  address: string | null;
  storeId: string | null;
}

export default function StockWarehousesPage() {
  const { t } = useI18n();
  const [warehouses, setWarehouses] = useState<Warehouse[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  function loadWarehouses() {
    apiFetch<Warehouse[]>("/stock/warehouses")
      .then(setWarehouses)
      .catch((err) => setListError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  useEffect(() => {
    loadWarehouses();
  }, []);

  async function handleCreate() {
    setFormError(null);
    try {
      await apiFetch("/stock/warehouses", {
        method: "POST",
        body: JSON.stringify({ name, address: address || undefined }),
      });
      setName("");
      setAddress("");
      loadWarehouses();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  return (
    <div>
      <SectionTabs
        tabs={[
          { href: "/stock", label: t("stock.tabs.products") },
          { href: "/stock/depots", label: t("stock.tabs.warehouses") },
          { href: "/stock/mouvements", label: t("stock.tabs.movements") },
          { href: "/stock/transferts", label: t("stock.tabs.transfers") },
        ]}
      />

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("stock.warehouses.new")}</h2>
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            type="text"
            placeholder={t("stock.warehouses.name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <input
            type="text"
            placeholder={t("delivery.address")}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm sm:col-span-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        {formError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{formError}</p>}
        <button onClick={handleCreate} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          {t("stock.warehouses.create")}
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        {listError && <p className="text-sm text-red-500 dark:text-red-400">{listError}</p>}
        {!listError && !warehouses && <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
        {warehouses && warehouses.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("stock.warehouses.noWarehouses")}</p>}
        {warehouses && warehouses.length > 0 && (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {warehouses.map((w) => (
              <li key={w.id} className="py-2 text-sm">
                <span className="font-medium text-slate-900 dark:text-white">{w.name}</span>
                {w.address && <span className="ml-2 text-slate-500 dark:text-slate-400">{w.address}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
