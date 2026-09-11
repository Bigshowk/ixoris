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

interface TransferLine {
  id: string;
  productId: string;
  quantity: string | number;
  product: Product;
}

interface Transfer {
  id: string;
  status: string;
  createdAt: string;
  receivedAt: string | null;
  fromWarehouse: Warehouse;
  toWarehouse: Warehouse;
  lines: TransferLine[];
}

interface DraftLine {
  productId: string;
  quantity: string;
}

export default function StockTransfersPage() {
  const { t } = useI18n();
  const [transfers, setTransfers] = useState<Transfer[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([{ productId: "", quantity: "" }]);
  const [formError, setFormError] = useState<string | null>(null);

  function loadTransfers() {
    apiFetch<Transfer[]>("/stock/transfers")
      .then(setTransfers)
      .catch((err) => setListError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  useEffect(() => {
    loadTransfers();
    apiFetch<Product[]>("/stock/products").then(setProducts).catch(() => {});
    apiFetch<Warehouse[]>("/stock/warehouses").then(setWarehouses).catch(() => {});
  }, []);

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { productId: "", quantity: "" }]);
  }

  async function handleCreate() {
    setFormError(null);
    if (!fromWarehouseId || !toWarehouseId) {
      setFormError(t("errors.required"));
      return;
    }
    const validLines = lines.filter((l) => l.productId && Number(l.quantity) > 0);
    if (validLines.length === 0) {
      setFormError(t("errors.required"));
      return;
    }
    try {
      await apiFetch("/stock/transfers", {
        method: "POST",
        body: JSON.stringify({
          fromWarehouseId,
          toWarehouseId,
          lines: validLines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity) })),
        }),
      });
      setFromWarehouseId("");
      setToWarehouseId("");
      setLines([{ productId: "", quantity: "" }]);
      loadTransfers();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function handleReceive(id: string) {
    try {
      await apiFetch(`/stock/transfers/${id}/receive`, { method: "POST" });
      loadTransfers();
    } catch {
      // handled by list refresh
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
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("stock.transfers.new")}</h2>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <select
            value={fromWarehouseId}
            onChange={(e) => setFromWarehouseId(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">{t("stock.transfers.from")}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <select
            value={toWarehouseId}
            onChange={(e) => setToWarehouseId(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">{t("stock.transfers.to")}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-2 space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <select
                value={line.productId}
                onChange={(e) => updateLine(i, { productId: e.target.value })}
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">{t("stock.movements.product")}</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder={t("stock.movements.quantity")}
                value={line.quantity}
                onChange={(e) => updateLine(i, { quantity: e.target.value })}
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          ))}
        </div>
        <button onClick={addLine} className="mb-3 text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
          + {t("stock.transfers.addLine")}
        </button>

        {formError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{formError}</p>}
        <div>
          <button onClick={handleCreate} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
            {t("stock.transfers.create")}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        {listError && <p className="text-sm text-red-500 dark:text-red-400">{listError}</p>}
        {!listError && !transfers && <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
        {transfers && transfers.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("stock.transfers.noTransfers")}</p>}
        {transfers && transfers.length > 0 && (
          <div className="space-y-3">
            {transfers.map((tr) => (
              <div key={tr.id} className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {tr.fromWarehouse.name} → {tr.toWarehouse.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        tr.status === "RECEIVED"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                      }`}
                    >
                      {tr.status}
                    </span>
                    {tr.status === "IN_TRANSIT" && (
                      <button
                        onClick={() => handleReceive(tr.id)}
                        className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500"
                      >
                        {t("stock.transfers.receive")}
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(tr.createdAt)}</p>
                <ul className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {tr.lines.map((l) => (
                    <li key={l.id}>
                      {l.product.name} × {Number(l.quantity)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
