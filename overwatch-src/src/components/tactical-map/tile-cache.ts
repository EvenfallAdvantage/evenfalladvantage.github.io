/**
 * SAR Tile Cache — browser-side caching for Sentinel Hub WMS tiles.
 *
 * Sentinel-1 revisits the same ground every ~6 days (12 days per satellite,
 * 6 days with the S-1A + S-1C constellation). Tiles don't change between
 * revisits, so we cache aggressively using the Cache API.
 *
 * Cache key: tile URL (includes bbox, time range, layer)
 * TTL: 6 days (matches Sentinel-1 revisit cycle)
 * Storage: Browser Cache API (persistent, survives page reloads)
 */

const CACHE_NAME = "overwatch-sar-tiles-v1";
const CACHE_TTL_MS = 6 * 24 * 60 * 60 * 1000; // 6 days

/**
 * Fetch a tile with caching. Returns the cached version if fresh,
 * otherwise fetches from the network and caches the result.
 */
export async function fetchWithCache(url: string): Promise<Response> {
  if (typeof caches === "undefined") {
    // Cache API not available (e.g., insecure context)
    return fetch(url);
  }

  try {
    const cache = await caches.open(CACHE_NAME);

    // Check cache first
    const cached = await cache.match(url);
    if (cached) {
      // Check if the cached response is still fresh
      const cachedTime = cached.headers.get("x-cache-time");
      if (cachedTime) {
        const age = Date.now() - parseInt(cachedTime, 10);
        if (age < CACHE_TTL_MS) {
          return cached;
        }
      }
    }

    // Fetch from network
    const response = await fetch(url);
    if (response.ok) {
      // Clone the response and add a cache timestamp header
      const cloned = response.clone();
      const body = await cloned.blob();
      const cachedResponse = new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          "Content-Type": response.headers.get("Content-Type") || "image/png",
          "x-cache-time": String(Date.now()),
        },
      });
      await cache.put(url, cachedResponse);
    }

    return response;
  } catch {
    // Cache API error — fall back to direct fetch
    return fetch(url);
  }
}

/**
 * Clear all cached SAR tiles (e.g., when user wants fresh data).
 */
export async function clearTileCache(): Promise<void> {
  if (typeof caches !== "undefined") {
    await caches.delete(CACHE_NAME);
  }
}

/**
 * Get cache stats (number of entries, approximate size).
 */
export async function getCacheStats(): Promise<{ entries: number; sizeKB: number }> {
  if (typeof caches === "undefined") return { entries: 0, sizeKB: 0 };

  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    let totalSize = 0;
    for (const key of keys) {
      const response = await cache.match(key);
      if (response) {
        const blob = await response.clone().blob();
        totalSize += blob.size;
      }
    }
    return { entries: keys.length, sizeKB: Math.round(totalSize / 1024) };
  } catch {
    return { entries: 0, sizeKB: 0 };
  }
}
