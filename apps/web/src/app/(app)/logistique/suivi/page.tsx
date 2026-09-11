"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, ApiError } from "../../../../lib/api";
import { useI18n } from "../../../../lib/i18n-context";
import { formatDate } from "../../../../lib/format";
import { SectionTabs } from "../../../../components/SectionTabs";
import { DeliveryMap, MapMarker } from "../../../../components/DeliveryMap";

type DeliveryStatus = "PENDING" | "LOADED" | "IN_TRANSIT" | "DELIVERED" | "FAILED" | "CANCELLED";

interface StatusHistoryEntry {
  status: DeliveryStatus;
  changedAt: string;
  latitude: number | null;
  longitude: number | null;
}

interface Delivery {
  id: string;
  number: string;
  status: DeliveryStatus;
  address: string;
  driver: { firstName: string; lastName: string } | null;
  vehicle: { plateNumber: string } | null;
  statusHistory: StatusHistoryEntry[];
}

const STATUS_COLOR: Record<DeliveryStatus, string> = {
  PENDING: "#94a3b8",
  LOADED: "#3b82f6",
  IN_TRANSIT: "#f59e0b",
  DELIVERED: "#10b981",
  FAILED: "#ef4444",
  CANCELLED: "#ef4444",
};

const REFRESH_MS = 20_000;
const ACTIVE_STATUSES = new Set<DeliveryStatus>(["LOADED", "IN_TRANSIT"]);

export default function LogistiqueSuiviPage() {
  const { t } = useI18n();
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function load() {
      apiFetch<Delivery[]>("/logistics/deliveries")
        .then((res) => {
          setDeliveries(res);
          setError(null);
        })
        .catch((err) => setError(err instanceof ApiError ? err.message : t("errors.networkError")));
    }
    load();
    // Live-ish tracking view: re-poll instead of a single fetch-on-mount, mirroring the Dashboard.
    const interval = setInterval(load, REFRESH_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markers = useMemo<MapMarker[]>(() => {
    if (!deliveries) return [];
    const result: MapMarker[] = [];
    for (const d of deliveries) {
      if (!ACTIVE_STATUSES.has(d.status)) continue;
      const lastPosition = [...d.statusHistory].reverse().find((h) => h.latitude != null && h.longitude != null);
      if (!lastPosition || lastPosition.latitude == null || lastPosition.longitude == null) continue;
      const driverLabel = d.driver ? `${d.driver.firstName} ${d.driver.lastName}` : t("logistique.deliveries.unassigned");
      result.push({
        id: d.id,
        label: `${d.number} — ${driverLabel}`,
        detail: `${d.address} · ${t(`delivery.status.${d.status}`)} · ${formatDate(lastPosition.changedAt)}`,
        latitude: lastPosition.latitude,
        longitude: lastPosition.longitude,
        color: STATUS_COLOR[d.status],
      });
    }
    return result;
  }, [deliveries, t]);

  return (
    <div>
      <SectionTabs
        tabs={[
          { href: "/logistique", label: t("logistique.tabs.deliveries") },
          { href: "/logistique/zones", label: t("logistique.tabs.zones") },
          { href: "/logistique/vehicules", label: t("logistique.tabs.vehicles") },
          { href: "/logistique/suivi", label: t("logistique.tabs.tracking") },
        ]}
      />

      {error && <p className="mb-3 text-sm text-red-500 dark:text-red-400">{error}</p>}
      {!error && !deliveries && <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}

      {deliveries && (
        <>
          <DeliveryMap markers={markers} />
          {markers.length === 0 && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{t("logistique.tracking.noActivePositions")}</p>}
        </>
      )}
    </div>
  );
}
