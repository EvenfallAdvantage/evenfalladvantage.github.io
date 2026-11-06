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
