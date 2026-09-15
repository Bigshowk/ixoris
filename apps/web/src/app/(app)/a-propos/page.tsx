"use client";

import { useEffect, useState } from "react";
import { IxorisLogo } from "@ixoris/ui";
import { useI18n } from "../../../lib/i18n-context";
import { API_URL } from "../../../lib/config";

const APP_VERSION = "v1.0.0 Enterprise Release";

type ServiceState = "checking" | "ok" | "error" | "unsupported";

interface StatusRowProps {
  label: string;
  state: ServiceState;
  okLabel: string;
  errorLabel: string;
  checkingLabel: string;
  unsupportedLabel: string;
}

const DOT_CLASS: Record<ServiceState, string> = {
  checking: "bg-slate-300 dark:bg-slate-600",
  ok: "bg-emerald-500",
  error: "bg-red-500",
  unsupported: "bg-slate-300 dark:bg-slate-600",
};

function StatusRow({ label, state, okLabel, errorLabel, checkingLabel, unsupportedLabel }: StatusRowProps) {
  const text = state === "ok" ? okLabel : state === "error" ? errorLabel : state === "unsupported" ? unsupportedLabel : checkingLabel;
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-slate-600 dark:text-slate-300">{label}</span>
      <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
        <span className={`h-2 w-2 rounded-full ${DOT_CLASS[state]}`} aria-hidden />
        {text}
      </span>
    </div>
  );
}

export default function AProposPage() {
  const { t } = useI18n();
  const [apiState, setApiState] = useState<ServiceState>("checking");
  const [dbState, setDbState] = useState<ServiceState>("checking");
  const [wsState, setWsState] = useState<ServiceState>("checking");
  const [offlineState, setOfflineState] = useState<ServiceState>("checking");

  useEffect(() => {
    setOfflineState(typeof navigator !== "undefined" && "serviceWorker" in navigator ? "ok" : "unsupported");

    fetch(`${API_URL}/health`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { api: "ok"; database: "ok" | "error"; websocket: "ok" | "error" }) => {
        setApiState("ok");
        setDbState(data.database === "ok" ? "ok" : "error");
        setWsState(data.websocket === "ok" ? "ok" : "error");
      })
      .catch(() => {
        setApiState("error");
        setDbState("error");
        setWsState("error");
      });
  }, []);

  return (
    <div className="max-w-xl space-y-6">
      <div className="text-slate-900 dark:text-white">
        <IxorisLogo variant="full" tagline />
      </div>
      <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{t("about.title")}</h1>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("about.founderSection")}</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-slate-500 dark:text-slate-400">{t("about.authorLabel")}</dt>
            <dd className="text-right text-slate-900 dark:text-white">
              Kader Salim
              <span className="block text-xs text-slate-500 dark:text-slate-400">{t("about.authorRole")}</span>
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-500 dark:text-slate-400">{t("about.publisherLabel")}</dt>
            <dd className="text-right text-slate-900 dark:text-white" style={{ letterSpacing: "0.04em", fontWeight: 500 }}>
              KADERSYS SOFTWARE SYSTEMS
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("about.techSheetSection")}</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-slate-500 dark:text-slate-400">{t("about.versionLabel")}</dt>
            <dd className="text-slate-900 dark:text-white">{APP_VERSION}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t("about.complianceNotice")}</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">{t("about.statusSection")}</h2>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <StatusRow
            label={t("about.statusApi")}
            state={apiState}
            okLabel={t("about.statusOk")}
            errorLabel={t("about.statusError")}
            checkingLabel={t("about.statusChecking")}
            unsupportedLabel={t("about.statusUnsupported")}
          />
          <StatusRow
            label={t("about.statusDatabase")}
            state={dbState}
            okLabel={t("about.statusOk")}
            errorLabel={t("about.statusError")}
            checkingLabel={t("about.statusChecking")}
            unsupportedLabel={t("about.statusUnsupported")}
          />
          <StatusRow
            label={t("about.statusWebsocket")}
            state={wsState}
            okLabel={t("about.statusOk")}
            errorLabel={t("about.statusError")}
            checkingLabel={t("about.statusChecking")}
            unsupportedLabel={t("about.statusUnsupported")}
          />
          <StatusRow
            label={t("about.statusOffline")}
            state={offlineState}
            okLabel={t("about.statusOk")}
            errorLabel={t("about.statusError")}
            checkingLabel={t("about.statusChecking")}
            unsupportedLabel={t("about.statusUnsupported")}
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">{t("about.copyrightSection")}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">© {new Date().getFullYear()} KADERSYS SOFTWARE SYSTEMS — {t("about.copyrightText")}</p>
      </section>
    </div>
  );
}
