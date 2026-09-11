"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../../lib/api";
import { useI18n } from "../../../../lib/i18n-context";
import { formatDate } from "../../../../lib/format";
import { SectionTabs } from "../../../../components/SectionTabs";

interface Supplier {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
}

interface PurchaseOrderLine {
  id: string;
  quantityOrdered: string | number;
  quantityReceived: string | number;
  product: Product;
}

interface PurchaseOrder {
  id: string;
  number: string;
  status: string;
  supplier: Supplier;
  lines: PurchaseOrderLine[];
}

interface ReceiptLine {
  id: string;
  quantityExpected: string | number;
  quantityReceived: string | number;
  quantityDamaged: string | number;
  quantityMissing: string | number;
  lotNumber: string | null;
  product: Product;
}

interface GoodsReceipt {
  id: string;
  number: string;
  status: string;
  receivedDate: string;
  purchaseOrder: { number: string; supplier: Supplier };
  lines: ReceiptLine[];
}

interface DraftLine {
  purchaseOrderLineId: string;
  productName: string;
  remaining: number;
  quantityReceived: string;
  quantityDamaged: string;
  lotNumber: string;
  expiryDate: string;
}

const RECEIVABLE_STATUSES = new Set(["SENT", "PARTIALLY_RECEIVED"]);

export default function AchatsReceiptsPage() {
  const { t } = useI18n();
  const [receipts, setReceipts] = useState<GoodsReceipt[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);

  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function loadReceipts() {
    apiFetch<GoodsReceipt[]>("/supply-chain/goods-receipts")
      .then(setReceipts)
      .catch((err) => setListError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  useEffect(() => {
    loadReceipts();
    apiFetch<PurchaseOrder[]>("/supply-chain/purchase-orders").then(setOrders).catch(() => {});
  }, []);

  const receivableOrders = orders.filter((o) => RECEIVABLE_STATUSES.has(o.status));

  function selectOrder(id: string) {
    setPurchaseOrderId(id);
    const order = orders.find((o) => o.id === id);
    if (!order) {
      setDraftLines([]);
      return;
    }
    setDraftLines(
      order.lines
        .filter((l) => Number(l.quantityReceived) < Number(l.quantityOrdered))
        .map((l) => ({
          purchaseOrderLineId: l.id,
          productName: l.product.name,
          remaining: Number(l.quantityOrdered) - Number(l.quantityReceived),
          quantityReceived: "",
          quantityDamaged: "",
          lotNumber: "",
          expiryDate: "",
        })),
    );
  }

  function updateDraftLine(index: number, patch: Partial<DraftLine>) {
    setDraftLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  async function handleCreate() {
    setFormError(null);
    if (!purchaseOrderId) {
      setFormError(t("errors.required"));
      return;
    }
    const validLines = draftLines.filter((l) => Number(l.quantityReceived) > 0 || Number(l.quantityDamaged) > 0);
    if (validLines.length === 0) {
      setFormError(t("errors.required"));
      return;
    }
    try {
      await apiFetch("/supply-chain/goods-receipts", {
        method: "POST",
        body: JSON.stringify({
          purchaseOrderId,
          lines: validLines.map((l) => ({
            purchaseOrderLineId: l.purchaseOrderLineId,
            quantityReceived: Number(l.quantityReceived) || 0,
            quantityDamaged: l.quantityDamaged ? Number(l.quantityDamaged) : undefined,
            lotNumber: l.lotNumber || undefined,
            expiryDate: l.expiryDate ? new Date(l.expiryDate).toISOString() : undefined,
          })),
        }),
      });
      setPurchaseOrderId("");
      setDraftLines([]);
      loadReceipts();
      apiFetch<PurchaseOrder[]>("/supply-chain/purchase-orders").then(setOrders).catch(() => {});
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function handleValidate(id: string) {
    setActionError(null);
    try {
      await apiFetch(`/supply-chain/goods-receipts/${id}/validate`, { method: "POST" });
      loadReceipts();
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
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("achats.receipts.new")}</h2>
        <select
          value={purchaseOrderId}
          onChange={(e) => selectOrder(e.target.value)}
          className="mb-3 w-full max-w-md rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="">{t("achats.receipts.selectOrder")}</option>
          {receivableOrders.map((o) => (
            <option key={o.id} value={o.id}>
              {o.number} — {o.supplier.name}
            </option>
          ))}
        </select>

        {draftLines.length > 0 && (
          <div className="mb-3 space-y-2">
            {draftLines.map((line, i) => (
              <div key={line.purchaseOrderLineId} className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:items-center">
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {line.productName}{" "}
                  <span className="text-xs text-slate-400">
                    ({line.remaining} {t("achats.receipts.remainingLabel")})
                  </span>
                </span>
                <input
                  type="number"
                  placeholder={t("achats.receipts.quantityReceived")}
                  value={line.quantityReceived}
                  onChange={(e) => updateDraftLine(i, { quantityReceived: e.target.value })}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <input
                  type="number"
                  placeholder={t("achats.receipts.quantityDamaged")}
                  value={line.quantityDamaged}
                  onChange={(e) => updateDraftLine(i, { quantityDamaged: e.target.value })}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <input
                  type="text"
                  placeholder={t("achats.receipts.lotNumber")}
                  value={line.lotNumber}
                  onChange={(e) => updateDraftLine(i, { lotNumber: e.target.value })}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <input
                  type="date"
                  title={t("achats.receipts.expiryDate")}
                  value={line.expiryDate}
                  onChange={(e) => updateDraftLine(i, { expiryDate: e.target.value })}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            ))}
          </div>
        )}

        {formError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{formError}</p>}
        <button
          onClick={handleCreate}
          disabled={draftLines.length === 0}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {t("achats.receipts.create")}
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        {actionError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{actionError}</p>}
        {listError && <p className="text-sm text-red-500 dark:text-red-400">{listError}</p>}
        {!listError && !receipts && <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
        {receipts && receipts.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("achats.receipts.noReceipts")}</p>}
        {receipts && receipts.length > 0 && (
          <div className="space-y-3">
            {receipts.map((grn) => (
              <div key={grn.id} className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {grn.number} — {grn.purchaseOrder.supplier.name} ({grn.purchaseOrder.number})
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        grn.status === "VALIDATED"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {grn.status}
                    </span>
                    {grn.status === "DRAFT" && (
                      <button
                        onClick={() => handleValidate(grn.id)}
                        className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500"
                      >
                        {t("achats.receipts.validate")}
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(grn.receivedDate)}</p>
                <ul className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {grn.lines.map((l) => (
                    <li key={l.id}>
                      {l.product.name} — {Number(l.quantityReceived)} {t("achats.receipts.receivedLabel")}
                      {Number(l.quantityDamaged) > 0 && `, ${Number(l.quantityDamaged)} ${t("achats.receipts.damagedLabel")}`}
                      {Number(l.quantityMissing) > 0 && `, ${Number(l.quantityMissing)} ${t("achats.receipts.missingLabel")}`}
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
