const CACHE_NAME = "overwatch-v1";
const STATIC_ASSETS = [
  "/overwatch/",
  "/overwatch/login/",
  "/overwatch/feed/",
  "/overwatch/images/logo-shield.png",
  "/overwatch/images/logo.png",
  "/overwatch/manifest.json",
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

  // Skip non-GET, cross-origin, and navigation requests (let browser handle pages)
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) return;
  if (request.mode === "navigate") return;

  // Network-first for API/data, cache-first for static assets
  if (request.url.includes("/api/") || request.url.includes("supabase")) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((r) => r || new Response("Offline", { status: 503 })))
    );
  } else {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached || new Response("Offline", { status: 503 }));
        return cached || networkFetch;
      })
    );
  }
});
