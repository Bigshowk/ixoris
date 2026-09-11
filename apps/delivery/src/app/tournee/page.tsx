"use client";

import { useCallback, useEffect, useState } from "react";
import { deliveryApi, DeliveryDTO } from "../../lib/delivery-api";
import { getSession, clearSession, DeliverySession } from "../../lib/session";
import { authApi } from "../../lib/auth-api";
import { useI18n } from "../../lib/i18n-context";
import { LoginScreen } from "../../components/LoginScreen";
import { ThemeToggle } from "../../components/ThemeToggle";
import { LocaleToggle } from "../../components/LocaleToggle";
import { DeliveryCard } from "../../components/DeliveryCard";
import { DeliveryDetail } from "../../components/DeliveryDetail";

export default function TourneePage() {
  const { t } = useI18n();
  const [session, setSession] = useState<DeliverySession | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryDTO[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSession(getSession());
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await deliveryApi.listMine();
      setDeliveries(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.networkError"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (session) refresh();
  }, [session, refresh]);

  async function handleLogout() {
    await authApi.logout();
    clearSession();
    setSession(null);
    setDeliveries([]);
    setSelectedId(null);
  }

  function handleUpdated(updated: DeliveryDTO) {
    setDeliveries((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    if (updated.status === "DELIVERED" || updated.status === "FAILED" || updated.status === "CANCELLED") {
      setSelectedId(null);
    }
  }

  if (!session) {
    return <LoginScreen onReady={() => setSession(getSession())} />;
  }

  const selected = deliveries.find((d) => d.id === selectedId) ?? null;
  const active = deliveries.filter((d) => d.status !== "DELIVERED" && d.status !== "FAILED" && d.status !== "CANCELLED");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{t("delivery.appTitle")}</h1>
        <div className="flex items-center gap-1">
          <LocaleToggle />
          <ThemeToggle />
          <button className="ml-2 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" onClick={handleLogout}>
            {t("common.logout")}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-3 p-4">
        {selected ? (
          <DeliveryDetail delivery={selected} onBack={() => setSelectedId(null)} onUpdated={handleUpdated} />
        ) : (
          <>
            <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400">{t("delivery.myDeliveries")}</h2>
            {loading && <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
            {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
            {!loading && active.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("delivery.noDeliveries")}</p>}
            {active.map((delivery) => (
              <DeliveryCard key={delivery.id} delivery={delivery} onClick={() => setSelectedId(delivery.id)} />
            ))}
          </>
        )}
      </main>
    </div>
  );
}
