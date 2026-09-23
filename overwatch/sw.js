/**
 * Overwatch service worker.
 *
 *
 * App-shell cache only. Network-first for HTML, stale-while-revalidate for
 * static assets, never cache /api/ or supabase calls.
 *
 * SCOPE: this file is served from /overwatch/sw.js. Browsers scope a worker
 * to its serving path, so this implicitly scopes to /overwatch/. Good - we
 * do NOT want to intercept requests from other apps on the same origin.
 *
 * CACHE BUSTING: cache key includes a version constant. Bump SW_VERSION
 * whenever the cached asset set changes; old caches are deleted on
 * `activate`. Browsers also auto-trigger an update check whenever the
 * worker source bytes change.
 */

// __BUILD_HASH__ is replaced at deploy time with the first 8 chars of the
// commit SHA by the GitHub Actions workflow (see .github/workflows/deploy.yml).
// Locally during `next build` it stays literal and the cache is just
// "overwatch-dev" - good enough for development.
const SW_VERSION = "__BUILD_HASH__";
const CACHE_NAME = `overwatch-${SW_VERSION === "__BUILD_HASH__" ? "dev" : SW_VERSION}`;
const BASE_PATH = "/overwatch";

// Minimal precache set - the shell HTML for the home route plus core
// assets. Next exports many .html files for each route; we precache only
// the most common ones and let runtime caching handle the rest.
const PRECACHE_URLS = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/feed/`,
  `${BASE_PATH}/incidents/`,
  `${BASE_PATH}/tasks/`,
  `${BASE_PATH}/manifest.json`,
  `${BASE_PATH}/images/icon-192.png`,
  `${BASE_PATH}/images/icon-512.png`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Best-effort precache; ignore individual failures so install
      // doesn't fail when the user is on a route we haven't built yet.
      await Promise.allSettled(
        PRECACHE_URLS.map((u) => cache.add(new Request(u, { credentials: "same-origin" }))),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("overwatch-") && k !== CACHE_NAME)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET. Mutations go through the offline queue, not the SW.
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Same-origin only.
  if (url.origin !== self.location.origin) return;

  // Stay out of the user's auth and API paths.
  if (url.pathname.startsWith(`${BASE_PATH}/api/`)) return;
  if (url.pathname.startsWith(`${BASE_PATH}/auth/`)) return;

  // Only intercept paths under our basePath.
  if (!url.pathname.startsWith(BASE_PATH)) return;

  // Strategy: network-first for HTML (so updates land), cache-first for
  // hashed static assets, stale-while-revalidate for everything else.
  const isHtml = req.mode === "navigate" || req.headers.get("accept")?.includes("text/html");
  const isHashedAsset = /\.[0-9a-f]{8,}\.(js|css|woff2?|png|jpg|svg|ico)$/i.test(url.pathname);

  if (isHtml) {
    event.respondWith(networkFirst(req));
    return;
  }
  if (isHashedAsset) {
    event.respondWith(cacheFirst(req));
    return;
  }
  event.respondWith(staleWhileRevalidate(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(req);
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    // As a last resort, return the cached home page so the user sees the
    // app shell instead of the browser's offline page.
    const fallback = await cache.match(`${BASE_PATH}/`);
    if (fallback) return fallback;
    throw new Error("Offline and no cached response");
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;
  const fresh = await fetch(req);
  if (fresh.ok) cache.put(req, fresh.clone());
  return fresh;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}
