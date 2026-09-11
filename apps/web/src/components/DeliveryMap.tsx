"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "../lib/i18n-context";

// Leaflet has no local package here (this workspace has no network access to install one) — loaded from a
// CDN at runtime instead, exactly like a plain HTML page would. `window.L` is untyped as a result.
declare global {
  interface Window {
    L?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const ABIDJAN: [number, number] = [5.3599, -4.0083];

let leafletLoadPromise: Promise<void> | null = null;

function loadLeaflet(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.L) return Promise.resolve();
  if (leafletLoadPromise) return leafletLoadPromise;

  leafletLoadPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }

    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Leaflet failed to load"));
    document.body.appendChild(script);
  });
  return leafletLoadPromise;
}

export interface MapMarker {
  id: string;
  label: string;
  detail: string;
  latitude: number;
  longitude: number;
  color: string;
}

export interface DeliveryMapProps {
  markers: MapMarker[];
}

/** Live delivery/driver positions on an OpenStreetMap base layer — markers are re-plotted whenever `markers` changes. */
export function DeliveryMap({ markers }: DeliveryMapProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerLayerRef = useRef<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then(() => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        const L = window.L;
        mapRef.current = L.map(containerRef.current).setView(ABIDJAN, 12);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(mapRef.current);
        markerLayerRef.current = L.layerGroup().addTo(mapRef.current);
        setReady(true);
      })
      .catch(() => setLoadError(t("logistique.tracking.mapLoadError")));

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !window.L || !markerLayerRef.current || !mapRef.current) return;
    const L = window.L;
    markerLayerRef.current.clearLayers();

    for (const m of markers) {
      const icon = L.divIcon({
        className: "",
        html: `<div style="background:${m.color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,.25)"></div>`,
        iconSize: [14, 14],
      });
      L.marker([m.latitude, m.longitude], { icon })
        .bindPopup(`<strong>${escapeHtml(m.label)}</strong><br/>${escapeHtml(m.detail)}`)
        .addTo(markerLayerRef.current);
    }

    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map((m) => [m.latitude, m.longitude]));
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [markers, ready]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
      {loadError && <p className="p-4 text-sm text-red-500 dark:text-red-400">{loadError}</p>}
      <div ref={containerRef} className="h-96 w-full bg-slate-100 dark:bg-slate-800" />
    </div>
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
