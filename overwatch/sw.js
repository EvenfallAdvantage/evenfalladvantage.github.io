const CACHE_NAME = "overwatch-v3";
const OFFLINE_URL = "/overwatch/offline.html";
const STATIC_ASSETS = [
  "/overwatch/",
  "/overwatch/login/",
  "/overwatch/feed/",
  "/overwatch/images/icon-192.png",
  "/overwatch/images/icon-512.png",
  "/overwatch/images/icon-maskable-192.png",
  "/overwatch/images/icon-maskable-512.png",
  "/overwatch/images/apple-touch-icon.png",
  "/overwatch/manifest.json",
  OFFLINE_URL,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip non-GET and cross-origin
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) return;

  // Navigation requests: network-first with offline fallback page
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Network-first for API/data
  if (request.url.includes("/api/") || request.url.includes("supabase")) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((r) => r || new Response("Offline", { status: 503 })))
    );
    return;
  }

  // Stale-while-revalidate for static assets
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request).then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => cached || caches.match(OFFLINE_URL));
      return cached || networkFetch;
    })
  );
});
