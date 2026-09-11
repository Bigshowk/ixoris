"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../lib/api";
import { useI18n } from "../../../lib/i18n-context";
import { formatXOF, formatDate } from "../../../lib/format";
import { SectionTabs } from "../../../components/SectionTabs";

interface Supplier {
  id: string;
  name: string;
  code: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
}

interface SupplierQuote {
  id: string;
  unitPrice: string | number;
  currencyCode: string;
  leadTimeDays: number;
  validFrom: string | null;
  validUntil: string | null;
  supplier: Supplier;
  product: Product;
}

export default function AchatsQuotesPage() {
  const { t } = useI18n();
  const [quotes, setQuotes] = useState<SupplierQuote[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  function loadQuotes() {
    apiFetch<SupplierQuote[]>("/supply-chain/quotes")
      .then(setQuotes)
      .catch((err) => setListError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  useEffect(() => {
    loadQuotes();
    apiFetch<Supplier[]>("/accounting/suppliers").then(setSuppliers).catch(() => {});
    apiFetch<Product[]>("/stock/products").then(setProducts).catch(() => {});
  }, []);

  async function handleCreate() {
    setFormError(null);
    if (!supplierId || !productId || !unitPrice) {
      setFormError(t("errors.required"));
      return;
    }
    try {
      await apiFetch("/supply-chain/quotes", {
        method: "POST",
        body: JSON.stringify({
          supplierId,
          productId,
          unitPrice: Number(unitPrice),
          leadTimeDays: leadTimeDays ? Number(leadTimeDays) : undefined,
          validFrom: validFrom ? new Date(validFrom).toISOString() : undefined,
          validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
        }),
      });
      setSupplierId("");
      setProductId("");
      setUnitPrice("");
      setLeadTimeDays("");
      setValidFrom("");
      setValidUntil("");
      loadQuotes();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("errors.networkError"));
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
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("achats.quotes.new")}</h2>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">{t("achats.quotes.supplier")}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">{t("achats.quotes.product")}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.sku} — {p.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder={t("achats.quotes.unitPrice")}
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <input
            type="number"
            placeholder={t("achats.quotes.leadTimeDays")}
            value={leadTimeDays}
            onChange={(e) => setLeadTimeDays(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <input
            type="date"
            title={t("achats.quotes.validFrom")}
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <input
            type="date"
            title={t("achats.quotes.validUntil")}
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        {formError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{formError}</p>}
        <button onClick={handleCreate} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          {t("achats.quotes.create")}
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        {listError && <p className="text-sm text-red-500 dark:text-red-400">{listError}</p>}
        {!listError && !quotes && <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
        {quotes && quotes.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("achats.quotes.noQuotes")}</p>}
        {quotes && quotes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="py-2">{t("achats.quotes.product")}</th>
                  <th className="py-2">{t("achats.quotes.supplier")}</th>
                  <th className="py-2 text-right">{t("achats.quotes.unitPrice")}</th>
                  <th className="py-2 text-right">{t("achats.quotes.leadTimeDays")}</th>
                  <th className="py-2">{t("achats.quotes.validFrom")}</th>
                  <th className="py-2">{t("achats.quotes.validUntil")}</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 text-slate-900 dark:text-white">{q.product.name}</td>
                    <td className="py-2 text-slate-700 dark:text-slate-300">{q.supplier.name}</td>
                    <td className="py-2 text-right text-slate-700 dark:text-slate-300">{formatXOF(q.unitPrice, q.currencyCode)}</td>
                    <td className="py-2 text-right text-slate-700 dark:text-slate-300">{q.leadTimeDays}</td>
                    <td className="py-2 text-slate-500 dark:text-slate-400">{q.validFrom ? formatDate(q.validFrom) : "—"}</td>
                    <td className="py-2 text-slate-500 dark:text-slate-400">{q.validUntil ? formatDate(q.validUntil) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
