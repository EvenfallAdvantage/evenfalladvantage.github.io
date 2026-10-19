/**
 * Keyless place search for the map search box.
 *
 * Photon (komoot public instance) first, OSM Nominatim as the fallback. Both
 * return OpenStreetMap data (ODbL 1.0, "© OpenStreetMap contributors").
 * Usage policy compliance:
 *  - search on submit only (no type-ahead autocomplete);
 *  - at most one upstream request per second (shared across the tab);
 *  - results cached in memory, limit 5;
 *  - the app is identified by its Referer (browsers do not let a page set
 *    User-Agent; Nominatim accepts Referer for browser apps).
 * Provider adapter shape follows gods-eye-view src/keylessGeocoder.js,
 * © 2026 Bilawal Sidhu, MIT — see docs/THIRD-PARTY-NOTICES.md.
 */

export interface PlaceResult {
  label: string;
  detail: string;
  lat: number;
  lng: number;
  /** [south, west, north, east] when the provider gives an extent. */
  bbox?: [number, number, number, number];
  source: "photon" | "nominatim" | "coordinates";
}

export const GEOCODE_CREDIT = "© OpenStreetMap contributors · Photon / Nominatim";
export const MIN_INTERVAL_MS = 1_000;
const LIMIT = 5;
const CACHE_MAX = 64;
const TIMEOUT_MS = 6_000;

const clean = (s: unknown) => String(s ?? "").replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, unknown> & { extent?: [number, number, number, number] };
}

export function normalizePhoton(body: unknown): PlaceResult[] {
  const feats = (body as { features?: PhotonFeature[] })?.features;
  if (!Array.isArray(feats)) return [];
  const out: PlaceResult[] = [];
  for (const f of feats) {
    const [lng, lat] = f.geometry?.coordinates ?? [];
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    const p = f.properties ?? {};
    const street = [p.housenumber, p.street].filter(Boolean).join(" ");
    const name = clean(p.name) || clean(street) || clean(p.city) || "Unnamed place";
    const detail = [street && street !== name ? street : "", p.city !== p.name ? p.city : "", p.state, p.country]
      .map(clean).filter(Boolean).join(", ");
    const e = p.extent; // [minLon, maxLat, maxLon, minLat]
    out.push({
      label: name, detail, lat, lng, source: "photon",
      ...(Array.isArray(e) && e.length === 4 ? { bbox: [e[3], e[0], e[1], e[2]] as [number, number, number, number] } : {}),
    });
  }
  return out.slice(0, LIMIT);
}

export function normalizeNominatim(body: unknown): PlaceResult[] {
  if (!Array.isArray(body)) return [];
  const out: PlaceResult[] = [];
  for (const r of body as Array<Record<string, unknown>>) {
    const lat = Number(r.lat), lng = Number(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const display = clean(r.display_name);
    const [first, ...rest] = display.split(", ");
    const bb = Array.isArray(r.boundingbox) ? (r.boundingbox as unknown[]).map(Number) : []; // [s, n, w, e]
    out.push({
      label: clean(r.name) || first || "Unnamed place", detail: rest.join(", "), lat, lng, source: "nominatim",
      ...(bb.length === 4 && bb.every(Number.isFinite) ? { bbox: [bb[0], bb[2], bb[1], bb[3]] as [number, number, number, number] } : {}),
    });
  }
  return out.slice(0, LIMIT);
}

export interface GeocoderDeps {
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/** Create a throttled, cached geocoder. One instance is shared by the app. */
export function createGeocoder(deps: GeocoderDeps = {}) {
  const doFetch = deps.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const now = deps.now ?? (() => Date.now());
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const cache = new Map<string, PlaceResult[]>();
  let nextSlot = 0;

  async function throttled(url: string, signal?: AbortSignal): Promise<unknown> {
    const t = now();
    const wait = Math.max(0, nextSlot - t);
    nextSlot = Math.max(t, nextSlot) + MIN_INTERVAL_MS;
    if (wait > 0) await sleep(wait);
    signal?.throwIfAborted();
    const res = await doFetch(url, {
      headers: { Accept: "application/json", "Accept-Language": "en" },
      referrerPolicy: "strict-origin-when-cross-origin",
      signal: signal ?? AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function search(query: string, signal?: AbortSignal): Promise<{ results: PlaceResult[]; error?: string }> {
    const q = clean(query).slice(0, 120);
    if (q.length < 2) return { results: [] };
    const key = q.toLowerCase();
    const hit = cache.get(key);
    if (hit) return { results: hit };
    let results: PlaceResult[] = [];
    let error: string | undefined;
    try {
      results = normalizePhoton(await throttled(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=${LIMIT}&lang=en`, signal));
    } catch (e) {
      if (signal?.aborted) throw e;
      error = "Photon unavailable";
    }
    if (!results.length) {
      try {
        results = normalizeNominatim(await throttled(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=${LIMIT}`, signal));
        error = undefined;
      } catch (e) {
        if (signal?.aborted) throw e;
        error = "Place search unavailable — try again shortly";
      }
    }
    if (results.length) {
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
      cache.set(key, results);
    }
    return { results, ...(error && !results.length ? { error } : {}) };
  }

  return { search };
}

let shared: ReturnType<typeof createGeocoder> | null = null;
export function sharedGeocoder() { return (shared ??= createGeocoder()); }
