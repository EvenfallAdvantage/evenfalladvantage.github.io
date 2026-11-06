import type { BuiltCompanyManifest } from "@/lib/pwa-company-install";
import {
  COMPANY_INSTALL_READY_MS,
  assessCompanyInstallFetch,
  type FinalizeAssessment,
  type IconProbe,
} from "@/lib/pwa-company-finalize";

/** Writes the company manifest and its snapshotted icons. Does not open any other cache. */
export async function writeCompanyCacheInBrowser(
  built: BuiltCompanyManifest,
  icons: { path: string; blob: Blob }[],
): Promise<void> {
  const cache = await caches.open(built.cacheName);
  const manifestUrl = new URL(built.manifestPath, location.origin).toString();
  await cache.put(
    manifestUrl,
    new Response(JSON.stringify(built.body), {
      headers: { "Content-Type": "application/manifest+json" },
    }),
  );
  for (const icon of icons) {
    if (!icon.path.startsWith(`/overwatch/pwa/${built.companyId}/`)) continue;
    await cache.put(
      new URL(icon.path, location.origin).toString(),
      new Response(icon.blob, { headers: { "Content-Type": "image/png" } }),
    );
  }
}

async function waitForControllingWorker(ms: number): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  const deadline = Date.now() + ms;
  const left = () => Math.max(0, deadline - Date.now());
  try {
    const claimed = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        navigator.serviceWorker.removeEventListener("controllerchange", finish);
        reject(new Error("timeout"));
      }, left());
      function finish() {
        clearTimeout(timer);
        resolve();
      }
      if (navigator.serviceWorker.controller) finish();
      else navigator.serviceWorker.addEventListener("controllerchange", finish, { once: true });
    });
    await navigator.serviceWorker.register("/overwatch/sw.js", { scope: "/overwatch/" });
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), left())),
    ]);
    await claimed;
    return navigator.serviceWorker.controller !== null;
  } catch {
    return false;
  }
}

/**
 * Proves the service worker will serve this company's cached manifest and icons.
 * The company URL is fetched only after the cache entries exist and this
 * document is controlled. `cache: "no-store"` keeps an earlier network 404
 * from answering. Failure does not navigate.
 */
export async function finalizeCompanyInstallInBrowser(
  built: BuiltCompanyManifest,
  icons: { path: string; blob: Blob }[],
): Promise<FinalizeAssessment> {
  const empty = { manifest: null, icons: [] as IconProbe[] };
  if (typeof caches === "undefined" || typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return assessCompanyInstallFetch({ built, storedIcons: [], cacheReady: false, controlling: false, ...empty });
  }
  const cache = await caches.open(built.cacheName);
  const manifestUrl = new URL(built.manifestPath, location.origin).toString();
  const manifestHit = await cache.match(manifestUrl);
  const companyIcons = icons.filter((icon) => icon.path.startsWith(`/overwatch/pwa/${built.companyId}/`));
  let iconsCached = true;
  for (const icon of companyIcons) {
    const hit = await cache.match(new URL(icon.path, location.origin).toString());
    if (!hit) iconsCached = false;
  }
  const expectedCompanyIcons = built.icons.filter((icon) => icon.src.startsWith(`/overwatch/pwa/${built.companyId}/`));
  const cacheReady = Boolean(manifestHit)
    && iconsCached
    && expectedCompanyIcons.every((icon) => companyIcons.some((stored) => stored.path === icon.src));
  if (!cacheReady) {
    return assessCompanyInstallFetch({ built, storedIcons: [], cacheReady: false, controlling: false, ...empty });
  }
  const controlling = await waitForControllingWorker(COMPANY_INSTALL_READY_MS);
  if (!controlling) {
    return assessCompanyInstallFetch({ built, storedIcons: [], cacheReady: true, controlling: false, ...empty });
  }
  const response = await fetch(manifestUrl, { cache: "no-store", credentials: "same-origin" });
  const manifest = {
    status: response.status,
    contentType: response.headers.get("content-type"),
    text: await response.text(),
  };
  const iconProbes: IconProbe[] = [];
  for (const icon of built.icons) {
    const iconResponse = await fetch(new URL(icon.src, location.origin).toString(), { cache: "no-store", credentials: "same-origin" });
    iconProbes.push({
      src: icon.src,
      status: iconResponse.status,
      contentType: iconResponse.headers.get("content-type"),
      bytes: new Uint8Array(await iconResponse.arrayBuffer()),
    });
  }
  const storedIcons = await Promise.all(companyIcons.map(async (icon) => ({
    path: icon.path,
    bytes: new Uint8Array(await icon.blob.arrayBuffer()),
  })));
  return assessCompanyInstallFetch({
    built,
    storedIcons,
    cacheReady: true,
    controlling: true,
    manifest,
    icons: iconProbes,
  });
}
