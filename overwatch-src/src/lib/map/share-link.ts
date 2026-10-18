/**
 * Share links for the Operations map: camera + visible layers in the URL hash.
 *
 * Hash format follows gods-eye-view's sharelink.js (© 2026 Bilawal Sidhu, MIT,
 * see docs/THIRD-PARTY-NOTICES.md):
 *   #lat=37.77&lon=-122.42&alt=800&heading=0&pitch=-35&layers=aircraft,cctv
 * Angles are degrees. Only boolean layer toggles are shared (never site
 * overlays or company data), and opening a link still requires sign-in.
 */

export interface SharedView {
  lat: number;
  lng: number;
  altM: number;
  headingDeg: number;
  pitchDeg: number;
  /** Boolean layer keys that should be on; undefined when the link has no layers param. */
  layers?: string[];
}

const MAX_ALT_M = 40_000_000;

function num(v: string | null): number | null {
  if (v == null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function encodeShareHash(v: SharedView): string {
  const p = new URLSearchParams();
  p.set("lat", v.lat.toFixed(5));
  p.set("lon", v.lng.toFixed(5));
  p.set("alt", String(Math.round(v.altM)));
  p.set("heading", v.headingDeg.toFixed(1));
  p.set("pitch", v.pitchDeg.toFixed(1));
  if (v.layers) p.set("layers", v.layers.join(","));
  return `#${p.toString().replace(/%2C/g, ",")}`;
}

/** Parse a share hash; returns null unless lat/lon/alt are present and sane. */
export function decodeShareHash(hash: string, knownLayers?: ReadonlySet<string>): SharedView | null {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const lat = num(p.get("lat"));
  const lng = num(p.get("lon"));
  const alt = num(p.get("alt"));
  if (lat == null || lng == null || alt == null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || alt <= 0 || alt > MAX_ALT_M) return null;
  const heading = num(p.get("heading")) ?? 0;
  const pitch = Math.max(-90, Math.min(90, num(p.get("pitch")) ?? -45));
  const raw = p.get("layers");
  const layers = raw == null
    ? undefined
    : raw.split(",").map((s) => s.trim()).filter((s) => s && /^[A-Za-z0-9]+$/.test(s) && (!knownLayers || knownLayers.has(s)));
  return { lat, lng, altM: alt, headingDeg: ((heading % 360) + 360) % 360, pitchDeg: pitch, layers };
}

/** Keys of `layers` that are boolean toggles currently on. */
export function activeBooleanLayers(layers: object): string[] {
  return Object.entries(layers).filter(([, v]) => v === true).map(([k]) => k);
}

/** Apply a shared layer list: listed boolean toggles on, other boolean toggles off. */
export function applySharedLayers<T extends object>(prev: T, shared: readonly string[]): T {
  const on = new Set(shared);
  const next: Record<string, unknown> = { ...(prev as Record<string, unknown>) };
  for (const [k, v] of Object.entries(next)) if (typeof v === "boolean") next[k] = on.has(k);
  return next as T;
}
