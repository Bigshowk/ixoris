"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../lib/api";
import { useI18n } from "../../../lib/i18n-context";
import { formatXOF, formatDate } from "../../../lib/format";

type DepreciationMethod = "STRAIGHT_LINE" | "DECLINING_BALANCE";
type FixedAssetStatus = "IN_SERVICE" | "DISPOSED" | "FULLY_DEPRECIATED";

interface Warehouse {
  id: string;
  name: string;
}

interface DepreciationEntry {
  id: string;
  sequenceNumber: number;
  periodEndDate: string;
  depreciationAmount: string | number;
  accumulatedDepreciation: string | number;
  netBookValue: string | number;
  isPosted: boolean;
}

interface Account {
  code: string;
  name: string;
}

interface FixedAsset {
  id: string;
  code: string;
  name: string;
  acquisitionDate: string;
  acquisitionCost: string | number;
  residualValue: string | number;
  usefulLifeYears: number;
  depreciationMethod: DepreciationMethod;
  decliningBalanceRate: string | number | null;
  status: FixedAssetStatus;
  disposalDate: string | null;
  disposalAmount: string | number | null;
  assetAccount: Account;
  depreciationAccount: Account;
  depreciationEntries: DepreciationEntry[];
}

const STATUS_STYLES: Record<FixedAssetStatus, string> = {
  IN_SERVICE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  DISPOSED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  FULLY_DEPRECIATED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

interface DepreciationResult {
  posted: number;
  skipped: number;
}

export default function ActifsPage() {
  const { t } = useI18n();
  const [assets, setAssets] = useState<FixedAsset[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [assetAccountCode, setAssetAccountCode] = useState("");
  const [depreciationAccountCode, setDepreciationAccountCode] = useState("");
  const [acquisitionDate, setAcquisitionDate] = useState("");
  const [acquisitionCost, setAcquisitionCost] = useState("");
  const [residualValue, setResidualValue] = useState("");
  const [usefulLifeYears, setUsefulLifeYears] = useState("");
  const [depreciationMethod, setDepreciationMethod] = useState<DepreciationMethod>("STRAIGHT_LINE");
  const [decliningBalanceRate, setDecliningBalanceRate] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [disposalAmount, setDisposalAmount] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const [depResult, setDepResult] = useState<DepreciationResult | null>(null);
  const [running, setRunning] = useState(false);

  function loadAssets() {
    apiFetch<FixedAsset[]>("/fixed-assets")
      .then(setAssets)
      .catch((err) => setListError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  useEffect(() => {
    loadAssets();
    apiFetch<Warehouse[]>("/stock/warehouses").then(setWarehouses).catch(() => {});
  }, []);

  async function handleCreate() {
    setFormError(null);
    if (!code || !name || !assetAccountCode || !depreciationAccountCode || !acquisitionDate || !acquisitionCost || !usefulLifeYears) {
      setFormError(t("errors.required"));
      return;
    }
    try {
      await apiFetch("/fixed-assets", {
        method: "POST",
        body: JSON.stringify({
          code,
          name,
          assetAccountCode,
          depreciationAccountCode,
          acquisitionDate: new Date(acquisitionDate).toISOString(),
          acquisitionCost: Number(acquisitionCost),
          residualValue: residualValue ? Number(residualValue) : undefined,
          usefulLifeYears: Number(usefulLifeYears),
          depreciationMethod,
          decliningBalanceRate: depreciationMethod === "DECLINING_BALANCE" && decliningBalanceRate ? Number(decliningBalanceRate) : undefined,
          warehouseId: warehouseId || undefined,
        }),
      });
      setCode("");
      setName("");
      setAssetAccountCode("");
      setDepreciationAccountCode("");
      setAcquisitionDate("");
      setAcquisitionCost("");
      setResidualValue("");
      setUsefulLifeYears("");
      setDecliningBalanceRate("");
      setWarehouseId("");
      loadAssets();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  function selectAsset(id: string) {
    setSelectedId(id);
    setActionError(null);
  }

  async function handleDispose() {
    if (!selectedId || !disposalAmount) {
      setActionError(t("errors.required"));
      return;
    }
    setActionError(null);
    try {
      await apiFetch(`/fixed-assets/${selectedId}/dispose`, {
        method: "POST",
        body: JSON.stringify({ disposalAmount: Number(disposalAmount) }),
      });
      setDisposalAmount("");
      loadAssets();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function handleRunDepreciation() {
    setRunning(true);
    setActionError(null);
    try {
      const res = await apiFetch<DepreciationResult>("/fixed-assets/depreciation/run", { method: "POST" });
      setDepResult(res);
      loadAssets();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("errors.networkError"));
    } finally {
      setRunning(false);
    }
  }

  const selectedAsset = assets?.find((a) => a.id === selectedId) ?? null;

  return (
    <div>
      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("actifs.new")}</h2>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input
            type="text"
            placeholder={t("actifs.code")}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <input
            type="text"
            placeholder={t("actifs.name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <input
            type="text"
            placeholder={t("actifs.assetAccountCode")}
            value={assetAccountCode}
            onChange={(e) => setAssetAccountCode(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <input
            type="text"
            placeholder={t("actifs.depreciationAccountCode")}
            value={depreciationAccountCode}
            onChange={(e) => setDepreciationAccountCode(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <input
            type="date"
            title={t("actifs.acquisitionDate")}
            value={acquisitionDate}
            onChange={(e) => setAcquisitionDate(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <input
            type="number"
            placeholder={t("actifs.acquisitionCost")}
            value={acquisitionCost}
            onChange={(e) => setAcquisitionCost(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <input
            type="number"
            placeholder={t("actifs.residualValue")}
            value={residualValue}
            onChange={(e) => setResidualValue(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <input
            type="number"
            placeholder={t("actifs.usefulLifeYears")}
            value={usefulLifeYears}
            onChange={(e) => setUsefulLifeYears(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <select
            value={depreciationMethod}
            onChange={(e) => setDepreciationMethod(e.target.value as DepreciationMethod)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="STRAIGHT_LINE">{t("actifs.methods.STRAIGHT_LINE")}</option>
            <option value="DECLINING_BALANCE">{t("actifs.methods.DECLINING_BALANCE")}</option>
          </select>
          {depreciationMethod === "DECLINING_BALANCE" && (
            <input
              type="number"
              placeholder={t("actifs.decliningBalanceRate")}
              value={decliningBalanceRate}
              onChange={(e) => setDecliningBalanceRate(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          )}
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">{t("actifs.warehouse")}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        {formError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{formError}</p>}
        <button onClick={handleCreate} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          {t("actifs.create")}
        </button>
      </section>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <button
          onClick={handleRunDepreciation}
          disabled={running}
          className="mb-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {t("actifs.runDepreciation")}
        </button>
        {depResult && (
          <div className="grid grid-cols-2 gap-4 sm:w-1/2">
            <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
              <p className="text-xs uppercase text-slate-500 dark:text-slate-400">{t("actifs.posted")}</p>
              <p className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">{depResult.posted}</p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
              <p className="text-xs uppercase text-slate-500 dark:text-slate-400">{t("actifs.skipped")}</p>
              <p className="text-xl font-semibold text-slate-900 dark:text-white">{depResult.skipped}</p>
            </div>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          {listError && <p className="text-sm text-red-500 dark:text-red-400">{listError}</p>}
          {!listError && !assets && <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
          {assets && assets.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("actifs.noAssets")}</p>}
          {assets && assets.length > 0 && (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {assets.map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => selectAsset(a.id)}
                    className={`flex w-full items-center justify-between py-2 text-left text-sm ${
                      selectedId === a.id ? "font-medium text-indigo-700 dark:text-indigo-300" : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <span>
                      {a.code} — {a.name}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[a.status]}`}>{t(`actifs.statuses.${a.status}`)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          {!selectedAsset && <p className="text-sm text-slate-500 dark:text-slate-400">{t("actifs.selectAsset")}</p>}
          {selectedAsset && (
            <>
              <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{selectedAsset.name}</h3>
              <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                  <p className="text-xs uppercase text-slate-500 dark:text-slate-400">{t("actifs.acquisitionCost")}</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{formatXOF(selectedAsset.acquisitionCost)}</p>
                </div>
                <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                  <p className="text-xs uppercase text-slate-500 dark:text-slate-400">{t("actifs.netBookValue")}</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {formatXOF(
                      selectedAsset.depreciationEntries.length > 0
                        ? selectedAsset.depreciationEntries[selectedAsset.depreciationEntries.length - 1].netBookValue
                        : selectedAsset.acquisitionCost,
                    )}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                  <p className="text-xs uppercase text-slate-500 dark:text-slate-400">{t("actifs.depreciationMethod")}</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{t(`actifs.methods.${selectedAsset.depreciationMethod}`)}</p>
                </div>
                <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                  <p className="text-xs uppercase text-slate-500 dark:text-slate-400">{t("actifs.usefulLifeYears")}</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedAsset.usefulLifeYears}</p>
                </div>
              </div>

              {actionError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{actionError}</p>}

              {selectedAsset.status === "IN_SERVICE" && (
                <div className="mb-4 flex gap-2">
                  <input
                    type="number"
                    placeholder={t("actifs.disposalAmount")}
                    value={disposalAmount}
                    onChange={(e) => setDisposalAmount(e.target.value)}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <button
                    onClick={handleDispose}
                    className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    {t("actifs.dispose")}
                  </button>
                </div>
              )}
              {selectedAsset.status === "DISPOSED" && (
                <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                  {formatDate(selectedAsset.disposalDate!)} · {formatXOF(selectedAsset.disposalAmount ?? 0)}
                </p>
              )}

              <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{t("actifs.schedule")}</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      <th className="py-2">{t("actifs.sequence")}</th>
                      <th className="py-2">{t("actifs.periodEndDate")}</th>
                      <th className="py-2 text-right">{t("actifs.depreciationAmount")}</th>
                      <th className="py-2 text-right">{t("actifs.accumulatedDepreciation")}</th>
                      <th className="py-2 text-right">{t("actifs.netBookValue")}</th>
                      <th className="py-2">{t("actifs.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAsset.depreciationEntries.map((entry) => (
                      <tr key={entry.id} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 text-slate-900 dark:text-white">{entry.sequenceNumber}</td>
                        <td className="py-2 text-slate-700 dark:text-slate-300">{formatDate(entry.periodEndDate)}</td>
                        <td className="py-2 text-right text-slate-700 dark:text-slate-300">{formatXOF(entry.depreciationAmount)}</td>
                        <td className="py-2 text-right text-slate-700 dark:text-slate-300">{formatXOF(entry.accumulatedDepreciation)}</td>
                        <td className="py-2 text-right text-slate-700 dark:text-slate-300">{formatXOF(entry.netBookValue)}</td>
                        <td className="py-2">
                          {entry.isPosted ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                              {t("compta.entries.posted")}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
