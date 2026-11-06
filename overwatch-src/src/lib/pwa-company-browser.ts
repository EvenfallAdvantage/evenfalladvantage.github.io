import type { BuiltCompanyManifest } from "@/lib/pwa-company-install";

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

/**
 * Registers the Overwatch worker and waits until one is active.
 * The document this runs in can still have a null controller. Callers
 * navigate after this returns; that next navigation is what the worker controls.
 * https://www.w3.org/TR/service-workers/#navigator-service-worker-ready
 */
export async function activateServiceWorkerForInstall(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  try {
    await navigator.serviceWorker.register("/overwatch/sw.js", { scope: "/overwatch/" });
    const registration = await navigator.serviceWorker.ready;
    return registration.active !== null;
  } catch {
    return false;
  }
}
