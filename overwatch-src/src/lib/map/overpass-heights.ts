/**
 * Optional raw OSM building heights from the public Overpass API (desktop
 * only). OpenMapTiles' z14 tiles carry one pre-computed height
 * (height, else levels × 3.66 m, else 5 m); Overpass gives the raw tags so we
 * can use roof heights, 3.0 m levels and typical heights for untagged
 * houses, garages and sheds. Data © OpenStreetMap contributors (ODbL).
 *
 * Fair use (Overpass usage policy): one request at a time, at least 10 s
 * apart, a per-browser daily cap, back-off on 429/504, results cached
 * for 7 days in the Cache API.
 */
import type { Building } from "./osm-buildings";

export const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
export const OVERPASS_MIN_GAP_MS = 10_000;
export const OVERPASS_DAILY_CAP = 200;
export const OVERPASS_BACKOFF_MS = 5 * 60_000;
export const OVERPASS_CACHE = "ow-overpass-heights-v1";
export const OVERPASS_TTL_MS = 7 * 86_400_000;
export const METERS_PER_LEVEL_RAW = 3.0;

export interface HeightPoint { lon: number; lat: number; height: number | null; minHeight: number | null; source: "height" | "levels" | "type" | null }

/** Query: building ways/relations in a bbox, tags and centre only (small). */
export function overpassQuery(b: { w: number; s: number; e: number; n: number }): string {
  const bb = `${b.s.toFixed(5)},${b.w.toFixed(5)},${b.n.toFixed(5)},${b.e.toFixed(5)}`;
  return `[out:json][timeout:25];(way["building"](${bb});relation["building"](${bb}););out tags center qt;`;
}

/** "12", "12 m", "12.5m", "40'", "40 ft" → metres. */
export function parseLength(v: unknown): number | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const s = String(v).trim().toLowerCase().replace(",", ".");
  const ft = s.match(/^([\d.]+)\s*(?:'|ft|feet)$/);
  if (ft) return Number(ft[1]) * 0.3048;
  const m = s.match(/^([\d.]+)\s*(?:m|metres|meters)?$/);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n >= 0 && n < 900 ? n : null;
}

const TYPE_HEIGHT: Record<string, number> = {
  house: 7, detached: 7, semidetached_house: 7, terrace: 8, residential: 7, bungalow: 4.5, farm: 7,
  garage: 3, garages: 3, carport: 2.6, shed: 2.6, hut: 2.8, cabin: 4, roof: 4, kiosk: 3, toilets: 3,
  greenhouse: 3.5, barn: 7, farm_auxiliary: 5, static_caravan: 3,
};

/** Height from raw OSM tags: height > levels (+ roof) > typical height by building type. */
export function heightFromTags(tags: Record<string, string>): Omit<HeightPoint, "lon" | "lat"> {
  const minHeight = parseLength(tags.min_height) ?? (tags["building:min_level"] != null ? (parseLength(tags["building:min_level"]) ?? 0) * METERS_PER_LEVEL_RAW : null);
  const h = parseLength(tags.height ?? tags["building:height"]);
  if (h !== null && h > 0) return { height: h, minHeight, source: "height" };
  const levels = parseLength(tags["building:levels"]);
  if (levels !== null && levels > 0) {
    const roof = parseLength(tags["roof:height"]) ?? (parseLength(tags["roof:levels"]) ?? 0) * 2.5;
    return { height: levels * METERS_PER_LEVEL_RAW + roof, minHeight, source: "levels" };
  }
  const t = TYPE_HEIGHT[tags.building];
  return t ? { height: t, minHeight, source: "type" } : { height: null, minHeight, source: null };
}

/** Overpass JSON → height points (elements with a centre and a usable height). */
export function parseOverpass(json: unknown): HeightPoint[] {
  const els = (json as { elements?: unknown[] })?.elements;
  if (!Array.isArray(els)) return [];
  const out: HeightPoint[] = [];
  for (const e of els as Array<{ center?: { lat: number; lon: number }; tags?: Record<string, string> }>) {
    if (!e?.center || !e.tags) continue;
    const r = heightFromTags(e.tags);
    if (r.source) out.push({ lon: e.center.lon, lat: e.center.lat, ...r });
  }
  return out;
}

function inRing(x: number, y: number, ring: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Apply raw heights to decoded buildings whose footprint contains a point.
 * "type" heights only replace OpenMapTiles' 5 m default. Returns the count changed.
 */
export function applyHeightPoints(buildings: Building[], pts: readonly HeightPoint[], omtDefault = 5): number {
  if (!pts.length || !buildings.length) return 0;
  const CELL = 0.0005; // ~50 m grid index
  const grid = new Map<string, number[]>();
  buildings.forEach((b, idx) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of b.rings[0]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(y0 / CELL); j <= Math.floor(y1 / CELL); j++) {
      const k = `${i},${j}`; const a = grid.get(k); if (a) a.push(idx); else grid.set(k, [idx]);
    }
  });
  let changed = 0;
  for (const p of pts) {
    const cand = grid.get(`${Math.floor(p.lon / CELL)},${Math.floor(p.lat / CELL)}`);
    if (!cand) continue;
    for (const idx of cand) {
      const b = buildings[idx];
      if (!inRing(p.lon, p.lat, b.rings[0])) continue;
      if (p.height !== null && (p.source !== "type" || b.height === omtDefault)) {
        const minH = p.minHeight !== null && p.minHeight < p.height ? p.minHeight : b.minHeight < p.height ? b.minHeight : 0;
        if (Math.abs(b.height - p.height) > 0.2 || minH !== b.minHeight) { b.height = p.height; b.minHeight = minH; changed++; }
      }
      break;
    }
  }
  return changed;
}

// ─── Fair-use gate (per browser) ──────────────────────────────────
const DAY_KEY = "ow:overpass:day";
let lastRequestAt = 0;
let backoffUntil = 0;
let inflight = false;

export function overpassAllowed(now = Date.now()): boolean {
  if (inflight || now < backoffUntil || now - lastRequestAt < OVERPASS_MIN_GAP_MS) return false;
  try {
    const d = JSON.parse(localStorage.getItem(DAY_KEY) ?? "null") as { day: string; n: number } | null;
    const today = new Date(now).toISOString().slice(0, 10);
    if (d && d.day === today && d.n >= OVERPASS_DAILY_CAP) return false;
  } catch { /* storage unavailable: still bounded by the gap */ }
  return true;
}
function countRequest(now: number) {
  try {
    const today = new Date(now).toISOString().slice(0, 10);
    const d = JSON.parse(localStorage.getItem(DAY_KEY) ?? "null") as { day: string; n: number } | null;
    localStorage.setItem(DAY_KEY, JSON.stringify({ day: today, n: d && d.day === today ? d.n + 1 : 1 }));
  } catch { /* ignore */ }
}

/** Cached or fresh raw heights for a bbox; null when skipped or failed (callers keep OMT heights). */
export async function fetchOverpassHeights(b: { w: number; s: number; e: number; n: number }, signal?: AbortSignal, now = Date.now()): Promise<HeightPoint[] | null> {
  const q = overpassQuery(b);
  const cacheUrl = `${OVERPASS_URL}?data=${encodeURIComponent(q)}`;
  let cache: Cache | null = null;
  try { cache = typeof caches !== "undefined" ? await caches.open(OVERPASS_CACHE) : null; } catch { cache = null; }
  if (cache) {
    try {
      const hit = await cache.match(cacheUrl);
      const at = Number(hit?.headers.get("x-ow-cached-at"));
      if (hit && Number.isFinite(at) && now - at < OVERPASS_TTL_MS) return parseOverpass(await hit.json());
    } catch { /* ignore */ }
  }
  if (!overpassAllowed(now)) return null;
  inflight = true; lastRequestAt = now; countRequest(now);
  try {
    const res = await fetch(OVERPASS_URL, { method: "POST", body: new URLSearchParams({ data: q }), signal });
    if (res.status === 429 || res.status === 504) { backoffUntil = Date.now() + OVERPASS_BACKOFF_MS; return null; }
    if (!res.ok) return null;
    const text = await res.text();
    if (cache) { try { await cache.put(cacheUrl, new Response(text, { headers: { "content-type": "application/json", "x-ow-cached-at": String(now) } })); } catch { /* quota */ } }
    return parseOverpass(JSON.parse(text));
  } catch { return null; } finally { inflight = false; }
}

/** Test hook: reset the fair-use gate. */
export function _resetOverpassGate() { lastRequestAt = 0; backoffUntil = 0; inflight = false; }
