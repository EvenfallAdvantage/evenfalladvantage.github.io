/**
 * Rocket launches (rolling 30 days) and a reconstructed ascent replay.
 *
 * Source: The Space Devs Launch Library 2 (v2.3), keyless public API
 * (15 calls/hour per client IP). Terms allow use and sharing in any form;
 * attribution is encouraged, so we credit "Launch Library 2 — The Space Devs".
 * The list is fetched by the browser at most every 15 minutes and kept in
 * sessionStorage.
 *
 * LL2 supplies launch metadata, not trajectories. The replay path is a coarse
 * ESTIMATE built from the pad, the target orbit's typical inclination and a
 * generic ascent profile, as gods-eye-view does (src/layers/launches/, MIT).
 * Failed launches get no path. The UI labels it as an estimate.
 */

export const LL2_API = "https://ll.thespacedevs.com/2.3.0";
export const LL2_CREDIT = "Launches: Launch Library 2 — The Space Devs";
export const WINDOW_DAYS = 30;
const CACHE_KEY = "ow:launches:v1";
const CACHE_MS = 15 * 60_000;

export type LaunchOutcome = "success" | "failure" | "partial" | "other";

export interface Launch {
  id: string;
  name: string;
  net: string;
  outcome: LaunchOutcome;
  status: string;
  provider: string | null;
  rocket: string | null;
  mission: string | null;
  orbit: string | null;
  orbitAbbrev: string | null;
  padName: string | null;
  location: string | null;
  lat: number;
  lng: number;
  image: string | null;
  infoUrl: string;
}

export function launchesUrl(nowMs: number, limit = 60): string {
  const since = new Date(nowMs - WINDOW_DAYS * 86400_000).toISOString().slice(0, 19) + "Z";
  return `${LL2_API}/launches/previous/?${new URLSearchParams({ mode: "normal", limit: String(limit), net__gte: since, ordering: "-net" })}`;
}

function outcomeOf(abbrev: string | undefined): LaunchOutcome {
  const a = (abbrev ?? "").toLowerCase();
  if (a === "success") return "success";
  if (a === "failure") return "failure";
  if (a === "partial failure" || a === "partial") return "partial";
  return "other";
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function parseLaunches(json: any): Launch[] {
  const out: Launch[] = [];
  for (const r of Array.isArray(json?.results) ? json.results : []) {
    const lat = Number(r?.pad?.latitude), lng = Number(r?.pad?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !r?.id) continue;
    const img = typeof r.image === "string" ? r.image : r.image?.thumbnail_url ?? r.image?.image_url ?? null;
    out.push({
      id: String(r.id), name: String(r.name ?? "Launch"), net: String(r.net ?? ""),
      outcome: outcomeOf(r.status?.abbrev), status: String(r.status?.name ?? r.status?.abbrev ?? "Unknown"),
      provider: r.launch_service_provider?.name ?? null, rocket: r.rocket?.configuration?.full_name ?? r.rocket?.configuration?.name ?? null,
      mission: r.mission?.description ?? null, orbit: r.mission?.orbit?.name ?? null, orbitAbbrev: r.mission?.orbit?.abbrev ?? null,
      padName: r.pad?.name ?? null, location: r.pad?.location?.name ?? null, lat, lng,
      image: typeof img === "string" && img.startsWith("https://") ? img : null,
      infoUrl: `https://ll.thespacedevs.com/2.3.0/launches/${encodeURIComponent(String(r.id))}/`,
    });
  }
  return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function loadLaunches(signal?: AbortSignal, nowMs = Date.now()): Promise<Launch[]> {
  try {
    const hit = sessionStorage.getItem(CACHE_KEY);
    if (hit) { const o = JSON.parse(hit); if (nowMs - o.at < CACHE_MS && Array.isArray(o.list)) return o.list; }
  } catch { /* no storage */ }
  const res = await fetch(launchesUrl(nowMs), { signal, credentials: "omit" });
  if (!res.ok) throw new Error(`LL2 HTTP ${res.status}`);
  const list = parseLaunches(await res.json());
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: nowMs, list })); } catch { /* quota */ }
  return list;
}

// ─── Reconstructed ascent (estimate) ───────────────────────────────

/** Typical inclination (deg) for an LL2 orbit abbreviation; null = launch due east (inclination ≈ pad latitude). */
export function typicalInclination(abbrev: string | null, padLat: number): number {
  const a = (abbrev ?? "").toUpperCase();
  if (a === "SSO") return 97.6;
  if (a === "PO") return 90;
  if (a === "MOLNIYA" || a === "HEO") return 63.4;
  if (a === "MEO") return 55;
  if (a === "ISS") return 51.6;
  return Math.max(Math.abs(padLat), 0.1);
}

/** Launch azimuth (deg from north). Polar/sun-synchronous go south (as from Vandenberg); others go north-east. */
export function launchAzimuth(padLat: number, inclinationDeg: number): number {
  const cl = Math.cos((padLat * Math.PI) / 180);
  const ratio = Math.max(-1, Math.min(1, Math.cos((inclinationDeg * Math.PI) / 180) / Math.max(cl, 1e-6)));
  const az = (Math.asin(ratio) * 180) / Math.PI; // north-going solution
  return inclinationDeg >= 80 ? 180 - az : az;
}

const R = 6_371_000;
/** Point at `distM` along `azDeg` from (lat,lng) on a sphere. */
export function destination(lat: number, lng: number, azDeg: number, distM: number): { lat: number; lng: number } {
  const p1 = (lat * Math.PI) / 180, l1 = (lng * Math.PI) / 180, b = (azDeg * Math.PI) / 180, d = distM / R;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return { lat: (p2 * 180) / Math.PI, lng: ((((l2 * 180) / Math.PI + 540) % 360) - 180) };
}

export const ASCENT_SECONDS = 540;
export const ASCENT_ALT_M = 210_000;
export const ASCENT_DOWNRANGE_M = 1_900_000;

/** Generic ascent profile at fraction f (0..1): vertical rise first, then pitch-over toward orbit. */
export function ascentAt(f: number): { altM: number; downrangeM: number } {
  const x = Math.max(0, Math.min(1, f));
  return { altM: ASCENT_ALT_M * Math.sin((x * Math.PI) / 2) ** 1.4, downrangeM: ASCENT_DOWNRANGE_M * x ** 2.2 };
}

export interface AscentPoint { t: number; lat: number; lng: number; altM: number }

/** Estimated ascent path, or null when no path should be drawn (failed launch). */
export function estimatedAscent(l: Pick<Launch, "lat" | "lng" | "orbitAbbrev" | "outcome">, samples = 60): AscentPoint[] | null {
  if (l.outcome === "failure") return null;
  const az = launchAzimuth(l.lat, typicalInclination(l.orbitAbbrev, l.lat));
  const pts: AscentPoint[] = [];
  for (let i = 0; i <= samples; i++) {
    const f = i / samples;
    const { altM, downrangeM } = ascentAt(f);
    const p = destination(l.lat, l.lng, az, downrangeM);
    pts.push({ t: f * ASCENT_SECONDS, lat: p.lat, lng: p.lng, altM });
  }
  return pts;
}

/** Replay length on screen (seconds) at 1× speed. */
export const REPLAY_SECONDS = 14;
export const REPLAY_SPEEDS = [0.5, 1, 2, 4] as const;

/** Seconds of flight covered by the replay (label scale). */
export const REPLAY_FLIGHT_S = 540;
/**
 * Fixed-width replay label ("T+045s ·  86 km"). Quantized to 5 s so the
 * label text changes a few times a second at most; the old per-frame text
 * made Cesium re-lay out glyphs every frame, which showed up as garbled digits.
 */
export function ascentLabel(f: number): string {
  const c = Math.max(0, Math.min(1, f));
  const t = Math.round((c * REPLAY_FLIGHT_S) / 5) * 5;
  const km = Math.round(ascentAt(t / REPLAY_FLIGHT_S).altM / 1000);
  return `T+${String(t).padStart(3, "0")}s · ${String(km).padStart(3, " ")} km`;
}
