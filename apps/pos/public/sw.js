// Minimal app-shell cache so the caisse UI still loads with no network.
// Data (products, carts, sales) is queued/replayed via IndexedDB in
// @ixoris/sync-client, not through the Service Worker — API responses change
// too often to cache usefully, and background sync support is inconsistent
// across mobile browsers.
const CACHE_NAME = "ixoris-pos-shell-v1";
const APP_SHELL = ["/caisse", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // never intercept cross-origin API calls

  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request).catch(() => caches.match("/caisse"))),
  );
});
