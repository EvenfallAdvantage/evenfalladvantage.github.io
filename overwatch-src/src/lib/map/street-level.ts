/**
 * Street-level photos from free, crowd-sourced providers that blur faces and
 * licence plates before publishing:
 *   - Panoramax (keyless; federated, faces/plates blurred on upload),
 *   - KartaView (keyless; only photos whose automatic processing reports
 *     BLURRED are used, and the processed "proc" image is shown),
 *   - Mapillary (needs a free client token; every image is auto-blurred).
 * Provider shapes follow gods-eye-view's street-level providers (MIT).
 *
 * The Mapillary client token is read at build time from the
 * NEXT_PUBLIC_MAPILLARY_CLIENT_TOKEN environment variable (GitHub Actions
 * secret of the same name, see .github/workflows/deploy.yml). Without it,
 * Mapillary is simply skipped. It is a public client token by design
 * (Mapillary issues it for browser apps), not a server secret.
 */

export type StreetProvider = "panoramax" | "kartaview" | "mapillary";

export interface StreetPhoto {
  provider: StreetProvider;
  id: string;
  lat: number;
  lng: number;
  heading: number | null;
  takenAt: string | null;
  thumbUrl: string;
  imageUrl: string;
  pageUrl: string;
  author: string | null;
  license: string;
}

export const STREET_CREDITS: Record<StreetProvider, string> = {
  panoramax: "Street photos: © Panoramax contributors (licence per photo)",
  kartaview: "Street photos: © KartaView contributors, CC BY-SA 4.0",
  mapillary: "Street photos: © Mapillary contributors, CC BY-SA 4.0",
};

export const STREET_PROVIDER_LABEL: Record<StreetProvider, string> = { panoramax: "Panoramax", kartaview: "KartaView", mapillary: "Mapillary" };

/** Only query when the camera is this close to the ground (metres). */
export const STREET_MAX_CAMERA_HEIGHT_M = 3000;

export function streetBudget(constrained: boolean): number { return constrained ? 60 : 200; }

export type BBox = [west: number, south: number, east: number, north: number];

/** Clamp a view box to at most `maxDeg` on a side around its centre (keeps provider queries small). */
export function clampBBox(b: BBox, maxDeg = 0.02): BBox {
  const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
  const hw = Math.min((b[2] - b[0]) / 2, maxDeg / 2), hh = Math.min((b[3] - b[1]) / 2, maxDeg / 2);
  return [cx - hw, cy - hh, cx + hw, cy + hh];
}

const httpsOnly = (u: unknown): string | null => {
  if (typeof u !== "string") return null;
  try { const url = new URL(u); return url.protocol === "https:" ? url.href : null; } catch { return null; }
};
const num = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) ? n : null; };

// ─── Panoramax ────────────────────────────────────────────────────
export const PANORAMAX_API = "https://api.panoramax.xyz/api";

export function panoramaxUrl(b: BBox, limit: number): string {
  return `${PANORAMAX_API}/search?${new URLSearchParams({ bbox: b.map((x) => x.toFixed(6)).join(","), limit: String(limit) })}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function parsePanoramax(json: any): StreetPhoto[] {
  const out: StreetPhoto[] = [];
  for (const f of Array.isArray(json?.features) ? json.features : []) {
    const [lng, lat] = f?.geometry?.coordinates ?? [];
    const thumb = httpsOnly(f?.assets?.thumb?.href), sd = httpsOnly(f?.assets?.sd?.href) ?? thumb;
    if (num(lat) == null || num(lng) == null || !thumb || !sd || !f?.id) continue;
    const providers = (f.providers ?? f.properties?.providers ?? []) as { name?: string }[];
    out.push({
      provider: "panoramax", id: String(f.id), lat: Number(lat), lng: Number(lng),
      heading: num(f.properties?.["view:azimuth"]), takenAt: f.properties?.datetime ?? null,
      thumbUrl: thumb, imageUrl: sd, pageUrl: `https://api.panoramax.xyz/#focus=pic&pic=${encodeURIComponent(String(f.id))}`,
      author: providers.map((p) => p?.name).filter(Boolean).join(", ") || null,
      license: String(f.properties?.license ?? "see photo page"),
    });
  }
  return out;
}

// ─── KartaView ────────────────────────────────────────────────────
export const KARTAVIEW_API = "https://api.kartaview.org";

export function kartaviewUrl(lat: number, lng: number, limit: number): string {
  return `${KARTAVIEW_API}/2.0/photo/?${new URLSearchParams({ lat: lat.toFixed(7), lng: lng.toFixed(7), zoomLevel: "18", itemsPerPage: String(Math.min(limit, 100)) })}`;
}

const KV_STORAGE = /^https:\/\/storage\d+\.openstreetcam\.org\//;

export function parseKartaview(json: any): StreetPhoto[] {
  const out: StreetPhoto[] = [];
  for (const r of Array.isArray(json?.result?.data) ? json.result.data : []) {
    // Privacy: only photos KartaView reports as blurred, and only the processed image.
    if (r?.autoImgProcessingStatus !== "FINISHED" || r?.autoImgProcessingResult !== "BLURRED") continue;
    const img = httpsOnly(r.fileurlProc);
    if (!img || !KV_STORAGE.test(img) || num(r.lat) == null || num(r.lng) == null) continue;
    out.push({
      provider: "kartaview", id: String(r.id), lat: Number(r.lat), lng: Number(r.lng),
      heading: num(r.heading), takenAt: r.shotDate ? String(r.shotDate).replace(" ", "T") + "Z" : null,
      thumbUrl: img, imageUrl: img,
      pageUrl: `https://kartaview.org/details/${encodeURIComponent(String(r.sequenceId))}/${encodeURIComponent(String(r.sequenceIndex ?? 0))}`,
      author: r.username ? String(r.username) : null, license: "CC BY-SA 4.0",
    });
  }
  return out;
}

// ─── Mapillary ────────────────────────────────────────────────────
export const MAPILLARY_GRAPH = "https://graph.mapillary.com";

export function mapillaryToken(): string {
  return (process.env.NEXT_PUBLIC_MAPILLARY_CLIENT_TOKEN ?? "").trim();
}

export function mapillaryUrl(b: BBox, limit: number, token: string): string {
  return `${MAPILLARY_GRAPH}/images?${new URLSearchParams({
    access_token: token, fields: "id,geometry,captured_at,compass_angle,thumb_256_url,thumb_1024_url,creator",
    bbox: b.map((x) => x.toFixed(6)).join(","), limit: String(Math.min(limit, 200)),
  })}`;
}

export function parseMapillary(json: any): StreetPhoto[] {
  const out: StreetPhoto[] = [];
  for (const r of Array.isArray(json?.data) ? json.data : []) {
    const [lng, lat] = r?.geometry?.coordinates ?? [];
    const big = httpsOnly(r?.thumb_1024_url), small = httpsOnly(r?.thumb_256_url) ?? big;
    if (num(lat) == null || num(lng) == null || !big || !small || !r?.id) continue;
    out.push({
      provider: "mapillary", id: String(r.id), lat: Number(lat), lng: Number(lng),
      heading: num(r.compass_angle), takenAt: r.captured_at ? new Date(Number(r.captured_at)).toISOString() : null,
      thumbUrl: small, imageUrl: big, pageUrl: `https://www.mapillary.com/app/?pKey=${encodeURIComponent(String(r.id))}`,
      author: r.creator?.username ? String(r.creator.username) : null, license: "CC BY-SA 4.0",
    });
  }
  return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { signal, credentials: "omit", referrerPolicy: "no-referrer" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** All providers in parallel; a failing provider just contributes nothing. */
export async function fetchStreetPhotos(b: BBox, opts: { limit: number; token?: string; signal?: AbortSignal }): Promise<{ photos: StreetPhoto[]; providers: StreetProvider[] }> {
  const box = clampBBox(b);
  const cy = (box[1] + box[3]) / 2, cx = (box[0] + box[2]) / 2;
  const per = Math.max(10, Math.ceil(opts.limit / 2));
  const jobs: [StreetProvider, Promise<StreetPhoto[]>][] = [
    ["panoramax", getJson(panoramaxUrl(box, per), opts.signal).then(parsePanoramax)],
    ["kartaview", getJson(kartaviewUrl(cy, cx, per), opts.signal).then(parseKartaview)],
  ];
  if (opts.token) jobs.push(["mapillary", getJson(mapillaryUrl(box, per, opts.token), opts.signal).then(parseMapillary)]);
  const settled = await Promise.allSettled(jobs.map((j) => j[1]));
  const photos: StreetPhoto[] = [], providers: StreetProvider[] = [];
  settled.forEach((s, i) => { if (s.status === "fulfilled" && s.value.length) { photos.push(...s.value); providers.push(jobs[i][0]); } });
  return { photos: dedupeAndCap(photos, opts.limit, cy, cx), providers };
}

/** Drop near-duplicates (same provider within ~5 m) and keep the nearest `limit` to the centre. */
export function dedupeAndCap(photos: StreetPhoto[], limit: number, lat: number, lng: number): StreetPhoto[] {
  const seen = new Set<string>();
  const d = (p: StreetPhoto) => (p.lat - lat) ** 2 + ((p.lng - lng) * Math.cos(lat * Math.PI / 180)) ** 2;
  return photos
    .filter((p) => { const k = `${p.provider}:${p.lat.toFixed(4)}:${p.lng.toFixed(4)}:${Math.round((p.heading ?? 0) / 45)}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => d(a) - d(b))
    .slice(0, limit);
}
