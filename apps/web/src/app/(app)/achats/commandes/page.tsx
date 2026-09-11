"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../../lib/api";
import { useI18n } from "../../../../lib/i18n-context";
import { formatXOF, formatDate } from "../../../../lib/format";
import { SectionTabs } from "../../../../components/SectionTabs";

interface Supplier {
  id: string;
  name: string;
  code: string;
}

interface Warehouse {
  id: string;
  name: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
}

interface PurchaseOrderLine {
  id: string;
  quantityOrdered: string | number;
  quantityReceived: string | number;
  unitPrice: string | number;
  tvaRate: string | number;
  total: string | number;
  product: Product;
}

interface PurchaseOrder {
  id: string;
  number: string;
  status: string;
  orderDate: string;
  expectedDate: string | null;
  totalTTC: string | number;
  currencyCode: string;
  supplier: Supplier;
  warehouse: Warehouse;
  lines: PurchaseOrderLine[];
}

interface DraftLine {
  productId: string;
  quantityOrdered: string;
  unitPrice: string;
  tvaRate: string;
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  SENT: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  PARTIALLY_RECEIVED: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  RECEIVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

export default function AchatsOrdersPage() {
  const { t } = useI18n();
  const [orders, setOrders] = useState<PurchaseOrder[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([{ productId: "", quantityOrdered: "", unitPrice: "", tvaRate: "18" }]);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function loadOrders() {
    apiFetch<PurchaseOrder[]>("/supply-chain/purchase-orders")
      .then(setOrders)
      .catch((err) => setListError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  useEffect(() => {
    loadOrders();
    apiFetch<Supplier[]>("/accounting/suppliers").then(setSuppliers).catch(() => {});
    apiFetch<Warehouse[]>("/stock/warehouses").then(setWarehouses).catch(() => {});
    apiFetch<Product[]>("/stock/products").then(setProducts).catch(() => {});
  }, []);

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { productId: "", quantityOrdered: "", unitPrice: "", tvaRate: "18" }]);
  }

  async function handleCreate() {
    setFormError(null);
    if (!supplierId || !warehouseId) {
      setFormError(t("errors.required"));
      return;
    }
    const validLines = lines.filter((l) => l.productId && Number(l.quantityOrdered) > 0);
    if (validLines.length === 0) {
      setFormError(t("errors.required"));
      return;
    }
    try {
      await apiFetch("/supply-chain/purchase-orders", {
        method: "POST",
        body: JSON.stringify({
          supplierId,
          warehouseId,
          expectedDate: expectedDate ? new Date(expectedDate).toISOString() : undefined,
          lines: validLines.map((l) => ({
            productId: l.productId,
            quantityOrdered: Number(l.quantityOrdered),
            unitPrice: Number(l.unitPrice) || 0,
            tvaRate: Number(l.tvaRate) || 0,
          })),
        }),
      });
      setSupplierId("");
      setWarehouseId("");
      setExpectedDate("");
      setLines([{ productId: "", quantityOrdered: "", unitPrice: "", tvaRate: "18" }]);
      loadOrders();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function handleSend(id: string) {
    setActionError(null);
    try {
      await apiFetch(`/supply-chain/purchase-orders/${id}/send`, { method: "POST" });
      loadOrders();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function handleCancel(id: string) {
    setActionError(null);
    try {
      await apiFetch(`/supply-chain/purchase-orders/${id}/cancel`, { method: "POST" });
      loadOrders();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  return (
    <div>
      <SectionTabs
        tabs={[
          { href: "/achats", label: t("achats.tabs.quotes") },
          { href: "/achats/commandes", label: t("achats.tabs.orders") },
          { href: "/achats/receptions", label: t("achats.tabs.receipts") },
          { href: "/achats/reappro", label: t("achats.tabs.reorder") },
        ]}
      />

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("achats.orders.new")}</h2>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">{t("achats.orders.supplier")}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">{t("achats.orders.warehouse")}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            title={t("achats.orders.expectedDate")}
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div className="mb-2 space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <select
                value={line.productId}
                onChange={(e) => updateLine(i, { productId: e.target.value })}
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">{t("achats.orders.product")}</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder={t("achats.orders.quantity")}
                value={line.quantityOrdered}
                onChange={(e) => updateLine(i, { quantityOrdered: e.target.value })}
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <input
                type="number"
                placeholder={t("achats.orders.unitPrice")}
                value={line.unitPrice}
                onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <input
                type="number"
                placeholder={t("achats.orders.tvaRate")}
                value={line.tvaRate}
                onChange={(e) => updateLine(i, { tvaRate: e.target.value })}
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          ))}
        </div>
        <button onClick={addLine} className="mb-3 text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
          + {t("achats.orders.addLine")}
        </button>

        {formError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{formError}</p>}
        <div>
          <button onClick={handleCreate} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
            {t("achats.orders.create")}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        {actionError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{actionError}</p>}
        {listError && <p className="text-sm text-red-500 dark:text-red-400">{listError}</p>}
        {!listError && !orders && <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
        {orders && orders.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("achats.orders.noOrders")}</p>}
        {orders && orders.length > 0 && (
          <div className="space-y-3">
            {orders.map((po) => (
              <div key={po.id} className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {po.number} — {po.supplier.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[po.status] ?? STATUS_STYLES.DRAFT}`}>{po.status}</span>
                    {po.status === "DRAFT" && (
                      <>
                        <button
                          onClick={() => handleSend(po.id)}
                          className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500"
                        >
                          {t("achats.orders.send")}
                        </button>
                        <button
                          onClick={() => handleCancel(po.id)}
                          className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          {t("achats.orders.cancel")}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {po.warehouse.name} · {formatDate(po.orderDate)} · {formatXOF(po.totalTTC, po.currencyCode)}
                </p>
                <ul className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {po.lines.map((l) => (
                    <li key={l.id}>
                      {l.product.name} × {Number(l.quantityOrdered)} ({Number(l.quantityReceived)} {t("achats.orders.receivedShort")})
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
