"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../../lib/api";
import { useI18n } from "../../../../lib/i18n-context";
import { formatDate } from "../../../../lib/format";
import { SectionTabs } from "../../../../components/SectionTabs";

interface Product {
  id: string;
  sku: string;
  name: string;
}

interface Warehouse {
  id: string;
  name: string;
}

interface StockLevel {
  productId: string;
  warehouseId: string;
  quantity: string | number;
  product: Product;
  warehouse: Warehouse;
}

interface StockMovement {
  id: string;
  type: string;
  quantity: string | number;
  reference: string | null;
  sourceType: string;
  createdAt: string;
  product: Product;
  warehouse: Warehouse;
}

export default function StockMovementsPage() {
  const { t } = useI18n();
  const [levels, setLevels] = useState<StockLevel[] | null>(null);
  const [movements, setMovements] = useState<StockMovement[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [listError, setListError] = useState<string | null>(null);

  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [type, setType] = useState<"ADJUSTMENT_IN" | "ADJUSTMENT_OUT">("ADJUSTMENT_IN");
  const [quantity, setQuantity] = useState("");
  const [reference, setReference] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  function loadLevels() {
    apiFetch<StockLevel[]>("/stock/levels")
      .then(setLevels)
      .catch((err) => setListError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  function loadMovements() {
    apiFetch<StockMovement[]>("/stock/movements").then(setMovements).catch(() => {});
  }

  useEffect(() => {
    loadLevels();
    loadMovements();
    apiFetch<Product[]>("/stock/products").then(setProducts).catch(() => {});
    apiFetch<Warehouse[]>("/stock/warehouses").then(setWarehouses).catch(() => {});
  }, []);

  async function handleAdjust() {
    setFormError(null);
    if (!productId || !warehouseId) {
      setFormError(t("errors.required"));
      return;
    }
    try {
      await apiFetch("/stock/movements", {
        method: "POST",
        body: JSON.stringify({
          productId,
          warehouseId,
          type,
          quantity: Number(quantity) || 0,
          reference: reference || undefined,
        }),
      });
      setQuantity("");
      setReference("");
      loadLevels();
      loadMovements();
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
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("stock.movements.adjust")}</h2>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">{t("stock.movements.product")}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.sku} — {p.name}
              </option>
            ))}
          </select>
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">{t("stock.movements.warehouse")}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "ADJUSTMENT_IN" | "ADJUSTMENT_OUT")}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="ADJUSTMENT_IN">ADJUSTMENT_IN</option>
            <option value="ADJUSTMENT_OUT">ADJUSTMENT_OUT</option>
          </select>
          <input
            type="number"
            placeholder={t("stock.movements.quantity")}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <input
            type="text"
            placeholder={t("stock.movements.reference")}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        {formError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{formError}</p>}
        <button onClick={handleAdjust} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          {t("stock.movements.create")}
        </button>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{t("stock.tabs.products")}</h3>
          {listError && <p className="text-sm text-red-500 dark:text-red-400">{listError}</p>}
          {!listError && !levels && <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
          {levels && levels.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("stock.movements.noStock")}</p>}
          {levels && levels.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="py-2">{t("stock.movements.product")}</th>
                    <th className="py-2">{t("stock.movements.warehouse")}</th>
                    <th className="py-2 text-right">{t("stock.movements.quantity")}</th>
                  </tr>
                </thead>
                <tbody>
                  {levels.map((l) => (
                    <tr key={`${l.productId}-${l.warehouseId}`} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2 text-slate-900 dark:text-white">{l.product.name}</td>
                      <td className="py-2 text-slate-700 dark:text-slate-300">{l.warehouse.name}</td>
                      <td className="py-2 text-right font-medium text-slate-900 dark:text-white">{Number(l.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{t("stock.tabs.movements")}</h3>
          {!movements && <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
          {movements && movements.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("stock.movements.noMovements")}</p>}
          {movements && movements.length > 0 && (
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="py-2">{t("stock.movements.type")}</th>
                    <th className="py-2">{t("stock.movements.product")}</th>
                    <th className="py-2 text-right">{t("stock.movements.quantity")}</th>
                    <th className="py-2">{t("rh.leave.date")}</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2 font-mono text-xs text-slate-700 dark:text-slate-300">{m.type}</td>
                      <td className="py-2 text-slate-900 dark:text-white">{m.product.name}</td>
                      <td className="py-2 text-right text-slate-700 dark:text-slate-300">{Number(m.quantity)}</td>
                      <td className="py-2 text-slate-500 dark:text-slate-400">{formatDate(m.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
