"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../lib/api";
import { useI18n } from "../../../lib/i18n-context";
import { formatXOF } from "../../../lib/format";
import { SectionTabs } from "../../../components/SectionTabs";

interface Category {
  id: string;
  name: string;
}

interface Brand {
  id: string;
  name: string;
}

interface Stock {
  warehouseId: string;
  quantity: string | number;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  purchasePrice: string | number;
  sellingPrice: string | number;
  minStockAlert: string | number;
  isActive: boolean;
  category: Category | null;
  brand: Brand | null;
  stocks: Stock[];
}

export default function StockProductsPage() {
  const { t } = useI18n();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [minStockAlert, setMinStockAlert] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newBrandName, setNewBrandName] = useState("");

  function loadProducts() {
    apiFetch<Product[]>("/stock/products")
      .then(setProducts)
      .catch((err) => setListError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  function loadCategories() {
    apiFetch<Category[]>("/stock/categories").then(setCategories).catch(() => {});
  }

  function loadBrands() {
    apiFetch<Brand[]>("/stock/brands").then(setBrands).catch(() => {});
  }

  useEffect(() => {
    loadProducts();
    loadCategories();
    loadBrands();
  }, []);

  async function handleCreate() {
    setFormError(null);
    try {
      await apiFetch("/stock/products", {
        method: "POST",
        body: JSON.stringify({
          sku,
          name,
          purchasePrice: Number(purchasePrice) || 0,
          sellingPrice: Number(sellingPrice) || 0,
          categoryId: categoryId || undefined,
          brandId: brandId || undefined,
          minStockAlert: Number(minStockAlert) || 0,
        }),
      });
      setSku("");
      setName("");
      setPurchasePrice("");
      setSellingPrice("");
      setMinStockAlert("");
      loadProducts();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function handleAddCategory() {
    if (!newCategoryName) return;
    await apiFetch("/stock/categories", { method: "POST", body: JSON.stringify({ name: newCategoryName }) }).catch(() => {});
    setNewCategoryName("");
    loadCategories();
  }

  async function handleAddBrand() {
    if (!newBrandName) return;
    await apiFetch("/stock/brands", { method: "POST", body: JSON.stringify({ name: newBrandName }) }).catch(() => {});
    setNewBrandName("");
    loadBrands();
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("stock.products.new")}</h2>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <input
              type="text"
              placeholder={t("stock.products.sku")}
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <input
              type="text"
              placeholder={t("stock.products.name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <input
              type="number"
              placeholder={t("stock.products.purchasePrice")}
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <input
              type="number"
              placeholder={t("stock.products.sellingPrice")}
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">{t("stock.products.category")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder={t("stock.products.minStockAlert")}
              value={minStockAlert}
              onChange={(e) => setMinStockAlert(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          {formError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{formError}</p>}
          <button onClick={handleCreate} className="mb-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
            {t("stock.products.create")}
          </button>

          <div className="overflow-x-auto">
            {listError && <p className="text-sm text-red-500 dark:text-red-400">{listError}</p>}
            {!listError && !products && <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
            {products && products.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("stock.products.noProducts")}</p>}
            {products && products.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="py-2">{t("stock.products.sku")}</th>
                    <th className="py-2">{t("stock.products.name")}</th>
                    <th className="py-2 text-right">{t("stock.products.sellingPrice")}</th>
                    <th className="py-2 text-right">{t("stock.products.quantity")}</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const totalQty = p.stocks.reduce((sum, s) => sum + Number(s.quantity), 0);
                    const low = totalQty <= Number(p.minStockAlert) && Number(p.minStockAlert) > 0;
                    return (
                      <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 font-mono text-xs text-slate-700 dark:text-slate-300">{p.sku}</td>
                        <td className="py-2 text-slate-900 dark:text-white">{p.name}</td>
                        <td className="py-2 text-right text-slate-700 dark:text-slate-300">{formatXOF(p.sellingPrice)}</td>
                        <td className={`py-2 text-right font-medium ${low ? "text-red-500" : "text-slate-900 dark:text-white"}`}>{totalQty}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{t("stock.products.newCategory")}</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <button onClick={handleAddCategory} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500">
                {t("common.save")}
              </button>
            </div>
            <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
              {categories.map((c) => (
                <li key={c.id}>{c.name}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{t("stock.products.newBrand")}</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <button onClick={handleAddBrand} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500">
                {t("common.save")}
              </button>
            </div>
            <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
              {brands.map((b) => (
                <li key={b.id}>{b.name}</li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
