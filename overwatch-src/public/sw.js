/**
 * Overwatch service worker.
 *
 * Caching strategy
 *   - Navigations (HTML): network-first (updates land), with a short timeout
 *     when a cached copy exists. Offline fallback order: cached page ->
 *     /offline.html. (It no longer falls back to the marketing landing page.)
 *   - RSC payloads (*.txt fetched by client-side navigation): network-first,
 *     cached copy when offline.
 *   - /_next/static/**: cache-first. Every file under it is content-hashed
 *     (Turbopack uses base36 names like `2zgy1mcgpg4zs.js`, which the old
 *     hex-only regex never matched), so a cached copy is always correct.
 *   - Other same-origin GETs (icons, manifest, images): stale-while-revalidate.
 *   - Never cached: non-GET, cross-origin (Supabase, CDNs), /auth/, /api/,
 *     Range requests, and large media/model files (.wasm, audio, video).
 *
 * Size limits
 *   Responses larger than MAX_ENTRY_BYTES are not cached, and each cache is
 *   capped by entry count (oldest evicted first; precached entries are kept).
 *
 * Precache
 *   The field-critical route shells (timeclock, patrols, incidents, feed,
 *   tasks, home) plus every hashed JS/CSS/font they need (crawled from the
 *   HTML and the chunks it references), and offline.html, so those screens
 *   open with no connection after the first online visit.
 *
 * SCOPE: served from /overwatch/sw.js, so it only controls /overwatch/.
 *
 * CACHE BUSTING: __BUILD_HASH__ is replaced at deploy time with the first 8
 * chars of the commit SHA (see .github/workflows/deploy.yml). Old caches are
 * deleted on `activate`. Locally the caches are just "...-dev".
 */

const SW_VERSION = "__BUILD_HASH__";
// NOTE: deploy.yml's sed replaces the placeholder everywhere in this file,
// so it must not be compared literally. The previous literal comparison was
// rewritten too, which pinned the live cache name to "overwatch-dev" and
// meant caches were never rotated between deploys.
const VERSION_TAG = SW_VERSION.startsWith("__") ? "dev" : SW_VERSION;
const BASE_PATH = "/overwatch";

const PAGES_CACHE = `overwatch-pages-${VERSION_TAG}`;
const STATIC_CACHE = `overwatch-static-${VERSION_TAG}`;
const RUNTIME_CACHE = `overwatch-runtime-${VERSION_TAG}`;

const OFFLINE_URL = `${BASE_PATH}/offline.html`;

// Route shells precached on install (trailingSlash: true in next.config).
const PRECACHE_PAGES = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/feed/`,
  `${BASE_PATH}/timeclock/`,
  `${BASE_PATH}/patrols/`,
  `${BASE_PATH}/incidents/`,
  `${BASE_PATH}/tasks/`,
];

const PRECACHE_ASSETS = [
  OFFLINE_URL,
  `${BASE_PATH}/manifest.json`,
  `${BASE_PATH}/images/icon-192.png`,
  `${BASE_PATH}/images/icon-512.png`,
];

// Per-cache entry caps. A full build has ~200 hashed JS/CSS/font files, so
// the static cap only bites if caches are never rotated (e.g. local "dev").
const MAX_ENTRIES = {
  [PAGES_CACHE]: 60,
  [STATIC_CACHE]: 400,
  [RUNTIME_CACHE]: 120,
};
const MAX_ENTRY_BYTES = 5 * 1024 * 1024; // skip caching anything bigger
const NEVER_CACHE = /\.(wasm|onnx|bin|mp3|wav|m4a|aac|ogg|oga|flac|mp4|m4v|webm|mov)$/i;
const NAV_TIMEOUT_MS = 4000;
// Precache crawl limits (see install handler).
const ASSET_REF_RE = /static\/(?:chunks|media|css)\/[A-Za-z0-9_.~-]+\.(?:js|css|woff2)/g;
const PRECACHE_DEPTH = 4;
const MAX_PRECACHE_ASSETS = 200;

const PROTECTED = new Set([...PRECACHE_PAGES, ...PRECACHE_ASSETS]);

// ── Install: precache shells, their hashed assets, and offline.html ─────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const pages = await caches.open(PAGES_CACHE);
      const statics = await caches.open(STATIC_CACHE);
      const runtime = await caches.open(RUNTIME_CACHE);

      // Best-effort: individual failures must not fail the install.
      await Promise.allSettled(
        PRECACHE_ASSETS.map((u) => runtime.add(new Request(u, { credentials: "same-origin" }))),
      );

      // Collect every hashed asset the precached routes need to boot offline:
      // <script>/<link> tags and inline flight data in the HTML, then chunks
      // referenced from those JS files (dynamic imports such as the
      // dashboard shell), a few levels deep. ~70 files / ~3.5 MB today.
      const seen = new Set();
      let frontier = [];
      const collect = (text) => {
        for (const m of text.match(ASSET_REF_RE) || []) {
          const url = `${BASE_PATH}/_next/${m}`;
          if (!seen.has(url) && seen.size < MAX_PRECACHE_ASSETS && !NEVER_CACHE.test(url)) {
            seen.add(url);
            frontier.push(url);
          }
        }
      };

      await Promise.allSettled(
        PRECACHE_PAGES.map(async (u) => {
          const res = await fetch(new Request(u, { credentials: "same-origin", cache: "no-cache" }));
          if (!res.ok) return;
          collect(await res.clone().text());
          await pages.put(u, res);
        }),
      );

      for (let depth = 0; depth < PRECACHE_DEPTH && frontier.length; depth++) {
        const batch = frontier;
        frontier = [];
        await Promise.allSettled(
          batch.map(async (url) => {
            const res = await fetch(new Request(url, { credentials: "same-origin" }));
            if (!isCacheable(res)) return;
            if (url.endsWith(".js")) collect(await res.clone().text());
            await statics.put(url, res);
          }),
        );
      }

      await self.skipWaiting();
    })(),
  );
});

// ── Activate: drop caches from previous versions ───────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PAGES_CACHE, STATIC_CACHE, RUNTIME_CACHE]);
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith("overwatch-") && !keep.has(k)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// ── Fetch routing ──────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only GET. Mutations go through the app's offline queue, not the SW.
  if (req.method !== "GET") return;
  // Let the browser handle media streaming / partial content.
  if (req.headers.has("range")) return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, CDNs, etc.
  if (!url.pathname.startsWith(BASE_PATH)) return;
  if (url.pathname.startsWith(`${BASE_PATH}/api/`)) return;
  if (url.pathname.startsWith(`${BASE_PATH}/auth/`)) return;
  if (NEVER_CACHE.test(url.pathname)) return;

  const isNavigation = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  if (isNavigation) {
    event.respondWith(handleNavigation(event, req));
    return;
  }

  if (url.pathname.startsWith(`${BASE_PATH}/_next/static/`)) {
    event.respondWith(cacheFirst(event, req, STATIC_CACHE));
    return;
  }

  const isRsc = req.headers.get("rsc") === "1" || url.searchParams.has("_rsc") || url.pathname.endsWith(".txt");
  if (isRsc) {
    event.respondWith(networkFirst(event, req, PAGES_CACHE));
    return;
  }

  event.respondWith(staleWhileRevalidate(event, req, RUNTIME_CACHE));
});

// ── Strategies ─────────────────────────────────────────────────────────────
// Each strategy registers its background cache write with event.waitUntil()
// while the respondWith() promise is still pending (calling it later can
// throw), and clones the response before the page consumes the body.
function fetchAndCache(event, req, cacheName, stripSearch) {
  const network = fetch(req);
  event.waitUntil(
    network
      .then((res) => (isCacheable(res) ? putAndTrim(cacheName, req, res.clone(), stripSearch) : undefined))
      .catch(() => {}),
  );
  return network;
}

async function handleNavigation(event, req) {
  const cache = await caches.open(PAGES_CACHE);
  const cached = (await cache.match(req)) || (await cache.match(req, { ignoreSearch: true }));
  const network = fetchAndCache(event, req, PAGES_CACHE, true);

  try {
    // With a cached copy, don't let a flaky connection hang the page.
    return cached ? await withTimeout(network, NAV_TIMEOUT_MS) : await network;
  } catch {
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;
    return Response.error();
  }
}

async function networkFirst(event, req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    return await fetchAndCache(event, req, cacheName, true);
  } catch (err) {
    const cached = (await cache.match(req)) || (await cache.match(req, { ignoreSearch: true }));
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(event, req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  return fetchAndCache(event, req, cacheName, false);
}

async function staleWhileRevalidate(event, req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetchAndCache(event, req, cacheName, false).catch(() => cached || Response.error());
  return cached || network;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function isCacheable(res) {
  if (!res || !res.ok || res.type !== "basic" || res.status !== 200) return false;
  const len = Number(res.headers.get("content-length") || 0);
  return !(len && len > MAX_ENTRY_BYTES);
}

async function putAndTrim(cacheName, req, res, stripSearch) {
  try {
    const cache = await caches.open(cacheName);
    let key = req;
    if (stripSearch) {
      // e.g. RSC "?_rsc=abc" cache-busters: store one copy per path.
      const u = new URL(req.url);
      u.search = "";
      key = u.toString();
    }
    await cache.put(key, res);
    await trimCache(cacheName);
  } catch {
    // Quota or other storage errors: caching is best-effort.
  }
}

async function trimCache(cacheName) {
  const max = MAX_ENTRIES[cacheName];
  if (!max) return;
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  const evictable = keys.filter((k) => !PROTECTED.has(new URL(k.url).pathname));
  const excess = keys.length - max;
  await Promise.all(evictable.slice(0, excess).map((k) => cache.delete(k)));
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}
