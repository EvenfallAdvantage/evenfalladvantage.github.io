/**
 * Global 10 m wind field for the animated wind particles.
 *
 * Source: NOAA/NCEP Global Forecast System (GFS, 0.5°, 3-hourly), served
 * keyless as JSON/CSV by the PacIOOS ERDDAP (University of Hawaiʻi, a NOAA
 * IOOS regional association). GFS output is U.S. Government public domain.
 * The browser fetches a strided subset (2.5° desktop, 5° on constrained
 * devices), about 0.2–0.5 MB, once per 3-hour model step, and keeps it in
 * sessionStorage so panning or toggling never refetches.
 *
 * Grid layout follows gods-eye-view's wind model (MIT): north-to-south rows,
 * seam-wrapped longitudes, bilinear sampling.
 */

export const WIND_ERDDAP = "https://pae-paha.pacioos.hawaii.edu/erddap/griddap/ncep_global";
export const WIND_FIELD_CREDIT = "Wind particles: NOAA/NCEP GFS 10 m wind (public domain) via PacIOOS ERDDAP";

export interface WindField {
  /** Model valid time, ISO (UTC). */
  time: string;
  nx: number;
  ny: number;
  /** Longitude of column 0 (degrees east, 0..360). */
  lo1: number;
  /** Latitude of row 0 (northernmost). */
  la1: number;
  dx: number;
  dy: number;
  u: Float32Array;
  v: Float32Array;
  /** True when this is the last saved field, used because the source is down. */
  stale?: boolean;
}

const STEP_MS = 3 * 3600_000;

/** Latest GFS 3-hourly valid time at or before `nowMs` (UTC), as ERDDAP ISO. */
export function windSlot(nowMs: number, stepsBack = 0): string {
  const t = Math.floor(nowMs / STEP_MS) * STEP_MS - stepsBack * STEP_MS;
  return new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Index stride on the 0.5° grid: 5 = 2.5° (desktop), 10 = 5° (constrained). */
export function windStride(constrained: boolean): number {
  return constrained ? 10 : 5;
}

export function windFieldUrl(time: string, stride: number): string {
  const deg = stride * 0.5;
  const latMax = 90 - deg / 2;
  const sub = `[(${time})][(${-latMax}):${stride}:(${latMax})][(0):${stride}:(${360 - deg})]`;
  const q = `ugrd10m${sub},vgrd10m${sub}`;
  return `${WIND_ERDDAP}.csv0?${encodeURIComponent(q).replace(/%2C/g, ",")}`;
}

/** Parse ERDDAP csv0 rows (time,lat,lon,u,v; lat ascending, lon fastest) into a north-to-south grid. */
export function parseWindCsv(text: string): WindField | null {
  const lats: number[] = [];
  const lons: number[] = [];
  const latIdx = new Map<number, number>();
  const lonIdx = new Map<number, number>();
  const rows: [number, number, number, number][] = [];
  let time = "";
  for (const line of text.split("\n")) {
    if (!line) continue;
    const p = line.split(",");
    if (p.length < 5) continue;
    const lat = Number(p[1]), lon = Number(p[2]);
    let u = Number(p[3]), v = Number(p[4]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (!Number.isFinite(u)) u = 0;
    if (!Number.isFinite(v)) v = 0;
    time ||= p[0];
    if (!latIdx.has(lat)) { latIdx.set(lat, lats.length); lats.push(lat); }
    if (!lonIdx.has(lon)) { lonIdx.set(lon, lons.length); lons.push(lon); }
    rows.push([lat, lon, u, v]);
  }
  const nx = lons.length, ny = lats.length;
  if (nx < 4 || ny < 4 || rows.length !== nx * ny) return null;
  const sortedLats = [...lats].sort((a, b) => b - a); // north first
  const sortedLons = [...lons].sort((a, b) => a - b);
  const yOf = new Map(sortedLats.map((l, i) => [l, i]));
  const xOf = new Map(sortedLons.map((l, i) => [l, i]));
  const u = new Float32Array(nx * ny), v = new Float32Array(nx * ny);
  for (const [lat, lon, uu, vv] of rows) {
    const i = yOf.get(lat)! * nx + xOf.get(lon)!;
    u[i] = uu; v[i] = vv;
  }
  return { time, nx, ny, lo1: sortedLons[0], la1: sortedLats[0], dx: sortedLons[1] - sortedLons[0], dy: sortedLats[0] - sortedLats[1], u, v };
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

/** Bilinear sample (m/s). Longitude wraps; latitude clamps to the grid. */
export function sampleWind(f: WindField, lon: number, lat: number, out: { u: number; v: number } = { u: 0, v: 0 }) {
  const x = ((((lon - f.lo1) % 360) + 360) % 360) / f.dx;
  const y = Math.max(0, Math.min(f.ny - 1, (f.la1 - lat) / f.dy));
  const x0 = Math.floor(x), tx = x - x0, y0 = Math.floor(y), ty = y - y0;
  const y1 = Math.min(f.ny - 1, y0 + 1);
  const l = ((x0 % f.nx) + f.nx) % f.nx, r = (l + 1) % f.nx;
  const a = y0 * f.nx + l, b = y0 * f.nx + r, c = y1 * f.nx + l, d = y1 * f.nx + r;
  out.u = lerp(lerp(f.u[a], f.u[b], tx), lerp(f.u[c], f.u[d], tx), ty);
  out.v = lerp(lerp(f.v[a], f.v[b], tx), lerp(f.v[c], f.v[d], tx), ty);
  return out;
}

// ─── sessionStorage cache (Int16, 0.01 m/s) ───────────────────────

function toB64(a: Int16Array): string {
  const bytes = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(s: string): Int16Array {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}
const pack = (a: Float32Array) => toB64(Int16Array.from(a, (x) => Math.max(-32767, Math.min(32767, Math.round(x * 100)))));
const unpack = (s: string) => Float32Array.from(fromB64(s), (x) => x / 100);

export function serializeWindField(f: WindField): string {
  return JSON.stringify({ ...f, u: pack(f.u), v: pack(f.v) });
}
export function deserializeWindField(s: string): WindField | null {
  try {
    const o = JSON.parse(s);
    const f: WindField = { ...o, u: unpack(o.u), v: unpack(o.v) };
    return f.u.length === f.nx * f.ny && f.v.length === f.nx * f.ny ? f : null;
  } catch { return null; }
}

const CACHE_KEY = "ow:wind-field:v1";

const LAST_KEY = "ow:wind-field:last:v1";
/** Last good field kept across sessions, used only when the source is down. */
export const WIND_LAST_MAX_AGE_MS = 24 * 3600_000;
const FETCH_TIMEOUT_MS = 20_000;
/** Background retries after a failed load: 1, 3, then 10 minutes. */
export const WIND_RETRY_MS = [60_000, 180_000, 600_000] as const;

function saveLast(stride: number, f: WindField, nowMs: number) {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(`${LAST_KEY}:${stride}`, JSON.stringify({ at: nowMs, f: serializeWindField(f) })); } catch { /* quota */ }
}
/** Last good field from localStorage if younger than maxAge, flagged stale. */
export function loadLastWindField(stride: number, nowMs = Date.now(), maxAgeMs = WIND_LAST_MAX_AGE_MS): WindField | null {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(`${LAST_KEY}:${stride}`) : null;
    if (!raw) return null;
    const o = JSON.parse(raw) as { at: number; f: string };
    const fieldMs = Date.parse(deserializeWindField(o.f)?.time ?? "");
    if (!Number.isFinite(o.at) || nowMs - o.at > maxAgeMs || (Number.isFinite(fieldMs) && nowMs - fieldMs > maxAgeMs)) return null;
    const f = deserializeWindField(o.f);
    return f ? { ...f, stale: true } : null;
  } catch { return null; }
}

async function fetchWithTimeout(url: string, signal?: AbortSignal): Promise<Response> {
  const t = new AbortController();
  const onAbort = () => t.abort();
  signal?.addEventListener("abort", onAbort);
  const timer = setTimeout(() => t.abort(), FETCH_TIMEOUT_MS);
  try { return await fetch(url, { signal: t.signal }); } finally { clearTimeout(timer); signal?.removeEventListener("abort", onAbort); }
}

/**
 * Fetch the newest available field (tries the current and previous 3-hour
 * slots), cached per session. If the source is down, falls back to the last
 * good field from an earlier visit (up to 24 h old, flagged `stale`).
 */
export async function loadWindField(constrained: boolean, signal?: AbortSignal, nowMs = Date.now()): Promise<WindField | null> {
  const stride = windStride(constrained);
  for (let back = 0; back < 3; back++) {
    const time = windSlot(nowMs, back);
    const key = `${CACHE_KEY}:${stride}:${time}`;
    try {
      const hit = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(key) : null;
      if (hit) { const f = deserializeWindField(hit); if (f) return f; }
    } catch { /* storage unavailable */ }
    try {
      const res = await fetchWithTimeout(windFieldUrl(time, stride), signal);
      if (!res.ok) continue;
      const f = parseWindCsv(await res.text());
      if (!f) continue;
      try {
        for (let i = sessionStorage.length - 1; i >= 0; i--) { const k = sessionStorage.key(i); if (k?.startsWith(CACHE_KEY)) sessionStorage.removeItem(k); }
        sessionStorage.setItem(key, serializeWindField(f));
      } catch { /* quota: keep in memory only */ }
      saveLast(stride, f, nowMs);
      return f;
    } catch {
      if (signal?.aborted) return null;
    }
  }
  return loadLastWindField(stride, nowMs);
}

/** Particle budget: phones get fewer, the performance governor trims further. */
export function windParticleBudget(constrained: boolean, perfLevel: number): number {
  const base = constrained ? 700 : 2800;
  return perfLevel >= 2 ? Math.round(base / 4) : perfLevel >= 1 ? Math.round(base / 2) : base;
}
/** Overlay frame interval (ms). */
export function windFrameMs(constrained: boolean, perfLevel: number): number {
  return perfLevel >= 2 ? 100 : constrained || perfLevel >= 1 ? 50 : 33;
}

/** Trail colour per look; the overlay is a 2D canvas above Cesium, so it mimics each post-process look itself. */
export function windStroke(look: { nvgGoggles?: boolean; flirThermal?: boolean; noir?: boolean; crtMode?: boolean }, speed: number): string {
  const a = Math.min(0.9, 0.35 + speed / 25);
  if (look.nvgGoggles) return `rgba(150,255,150,${a})`;
  if (look.crtMode) return `rgba(80,255,120,${a})`;
  if (look.flirThermal) return `rgba(255,255,255,${a})`;
  if (look.noir) return `rgba(225,225,225,${a})`;
  // calm cyan → strong amber
  const t = Math.min(1, speed / 20);
  const r = Math.round(lerp(150, 255, t)), g = Math.round(lerp(230, 190, t)), b = Math.round(lerp(255, 90, t));
  return `rgba(${r},${g},${b},${a})`;
}
