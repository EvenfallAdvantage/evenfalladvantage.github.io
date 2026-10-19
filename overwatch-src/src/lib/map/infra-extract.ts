/**
 * Client side of the pre-built OpenStreetMap infrastructure extract
 * (public/data/infra/, built by scripts/build-infra-extract.mjs).
 *
 * Data: © OpenStreetMap contributors, ODbL 1.0. Datacenters, dams and named
 * military areas come via gods-eye-view (MIT code © 2026 Bilawal Sidhu; its
 * bundled data is ODbL); high-voltage power comes from Overpass when built.
 * Pure helpers only (no Cesium), so they are unit-tested.
 */

export type InfraKind = "d" | "w" | "m" | "s";

/** Row as stored in a cell file: [kind, lng, lat, name, extra?]. */
export type InfraRow = [InfraKind, number, number, string, string?];
/** Power line as stored: [kV, [[lng, lat], ...]]. */
export type InfraLine = [number, Array<[number, number]>];

export interface InfraCell { f: InfraRow[]; l?: InfraLine[] }

export interface InfraIndex {
  v: number;
  built: string;
  cell: number;
  credit: string;
  counts: Record<string, number>;
  pendingTiles?: string[];
  cells: Record<string, number>;
}

export interface InfraFeature {
  kind: InfraKind;
  lng: number;
  lat: number;
  name: string;
  detail: string;
  osmUrl?: string;
  /** Substation voltage in kV, when known. */
  kv?: number;
}

export const INFRA_CREDIT = "© OpenStreetMap contributors (ODbL)";

export const INFRA_KINDS: Record<InfraKind, { label: string; color: string }> = {
  d: { label: "Data centre", color: "#38bdf8" },
  w: { label: "Dam", color: "#2dd4bf" },
  m: { label: "Military area", color: "#e879f9" },
  s: { label: "Substation", color: "#facc15" },
};

const MILITARY_CLASS: Record<string, string> = {
  military_land: "Military land",
  airfield: "Military airfield",
  naval_base: "Naval base",
  range: "Range",
  barracks: "Barracks",
  base: "Base",
  training_area: "Training area",
};

const OSM_TYPES: Record<string, string> = { n: "node", w: "way", r: "relation" };

/** Turn a stored row into something the map can show. Returns null for junk rows. */
export function decodeInfraRow(row: unknown): InfraFeature | null {
  if (!Array.isArray(row) || row.length < 4) return null;
  const [kind, lng, lat, name, extra] = row as InfraRow;
  if (!(kind in INFRA_KINDS) || !Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const label = INFRA_KINDS[kind].label;
  let detail = label;
  let osmUrl: string | undefined;
  if (kind === "d" && extra) detail = `${label} · ${extra}`;
  let kv: number | undefined;
  if (kind === "s" && extra && Number(extra) > 0) { kv = Number(extra); detail = `${label} · ${extra} kV`; }
  if (kind === "m" && extra) {
    const [cls, id] = extra.split("|");
    detail = MILITARY_CLASS[cls] ?? label;
    const m = /^([nwr])(\d+)$/.exec(id ?? "");
    if (m) osmUrl = `https://www.openstreetmap.org/${OSM_TYPES[m[1]]}/${m[2]}`;
  }
  return { kind, lng, lat, name: String(name ?? label).slice(0, 80) || label, detail, osmUrl, ...(kv ? { kv } : {}) };
}

/** Cell key the builder uses for a point. */
export function infraCellKey(lng: number, lat: number, cell = 10): string {
  return `${Math.floor(lat / cell) * cell}_${Math.floor(lng / cell) * cell}`;
}

/**
 * Cell keys covering a view rectangle (degrees). Handles boxes that cross
 * the antimeridian (west > east). Only keys present in `available` are
 * returned, nearest-first is not needed because the caller caps the count.
 */
export function infraCellsForView(
  view: { west: number; south: number; east: number; north: number },
  available: Record<string, number>,
  cell = 10,
): string[] {
  const out: string[] = [];
  const s = Math.floor(Math.max(-90, view.south) / cell) * cell;
  const n = Math.floor(Math.min(89.999, view.north) / cell) * cell;
  const spans: Array<[number, number]> = view.west <= view.east
    ? [[view.west, view.east]]
    : [[view.west, 180], [-180, view.east]];
  for (const [w0, e0] of spans) {
    const w = Math.floor(Math.max(-180, w0) / cell) * cell;
    const e = Math.floor(Math.min(179.999, e0) / cell) * cell;
    for (let lat = s; lat <= n; lat += cell) {
      for (let lng = w; lng <= e; lng += cell) {
        const k = `${lat}_${lng}`;
        if (available[k] && !out.includes(k)) out.push(k);
      }
    }
  }
  return out;
}

/** Above this camera height the layer hides (too many points to be useful). */
export const INFRA_MAX_HEIGHT_M = 2_500_000;
/** Labels appear below this camera distance. */
export const INFRA_LABEL_DISTANCE_M = 12_000;
/** Most cells loaded for one view. */
export const INFRA_MAX_CELLS = 9;

/** View limits per device class: phones load fewer cells, only closer in, without labels. */
export interface InfraLimits {
  maxCells: number;
  maxHeightM: number;
  labels: boolean;
  /** Substations below this voltage are skipped (phones keep only the big ones). */
  minSubstationKv: number;
  /** Substations and transmission lines draw only below this camera height (there are many). */
  powerMaxHeightM: number;
  /** Most transmission lines drawn for one view. */
  maxLines: number;
}
export function infraLimits(constrained: boolean): InfraLimits {
  return constrained
    ? { maxCells: 4, maxHeightM: 800_000, labels: false, minSubstationKv: 230, powerMaxHeightM: 400_000, maxLines: 800 }
    : { maxCells: INFRA_MAX_CELLS, maxHeightM: INFRA_MAX_HEIGHT_M, labels: true, minSubstationKv: 0, powerMaxHeightM: 1_000_000, maxLines: 3_000 };
}

/** Whether a decoded row passes the device's limits at this camera height (only substations are filtered). */
export function keepInfraFeature(
  f: InfraFeature,
  limits: Pick<InfraLimits, "minSubstationKv" | "powerMaxHeightM">,
  heightM = 0,
): boolean {
  if (f.kind !== "s") return true;
  if (heightM > limits.powerMaxHeightM) return false;
  return limits.minSubstationKv <= 0 || (f.kv ?? 0) >= limits.minSubstationKv;
}

/** Transmission line styling by voltage: wider and warmer for the backbone. */
export function lineStyle(kv: number): { width: number; color: string } {
  if (kv >= 700) return { width: 2.6, color: "#f97316" };
  if (kv >= 500) return { width: 2.1, color: "#fb923c" };
  return { width: 1.5, color: "#fbbf24" };
}

/**
 * Whether a line's bounding box touches the view (padded by `padDeg`). Cells are
 * 10° wide, so this keeps far-off lines in a loaded cell from being drawn. Views
 * across the antimeridian are not filtered.
 */
export function lineInView(
  pts: ReadonlyArray<readonly [number, number]>,
  view: { west: number; south: number; east: number; north: number },
  padDeg = 0.5,
): boolean {
  if (view.west > view.east) return true;
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [lng, lat] of pts) {
    if (lng < w) w = lng; if (lng > e) e = lng;
    if (lat < s) s = lat; if (lat > n) n = lat;
  }
  return e >= view.west - padDeg && w <= view.east + padDeg && n >= view.south - padDeg && s <= view.north + padDeg;
}

/**
 * Pick at most `max` lines, nearest to `focus` first (by bounding-box distance, in
 * degrees with longitude scaled by latitude), so a capped view keeps the lines
 * around where the user is looking rather than whichever cell loaded first.
 */
export function nearestLines<T extends { pts: ReadonlyArray<readonly [number, number]> }>(
  lines: T[],
  focus: { lng: number; lat: number },
  max: number,
): T[] {
  if (lines.length <= max) return lines;
  const k = Math.cos((focus.lat * Math.PI) / 180);
  const dist = (pts: ReadonlyArray<readonly [number, number]>) => {
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
    for (const [lng, lat] of pts) {
      if (lng < w) w = lng; if (lng > e) e = lng;
      if (lat < s) s = lat; if (lat > n) n = lat;
    }
    const dx = focus.lng < w ? w - focus.lng : focus.lng > e ? focus.lng - e : 0;
    const dy = focus.lat < s ? s - focus.lat : focus.lat > n ? focus.lat - n : 0;
    return (dx * k) ** 2 + dy ** 2;
  };
  return lines
    .map((l) => ({ l, d: dist(l.pts) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, max)
    .map((x) => x.l);
}

/** Decode a stored line row; null for junk. */
export function decodeInfraLine(row: unknown): { kv: number; pts: Array<[number, number]> } | null {
  if (!Array.isArray(row) || row.length < 2 || !Array.isArray(row[1])) return null;
  const kv = Number(row[0]);
  const pts = (row[1] as unknown[]).filter((p): p is [number, number] =>
    Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0] as number) <= 180 && Math.abs(p[1] as number) <= 90);
  return pts.length >= 2 ? { kv: Number.isFinite(kv) ? kv : 0, pts } : null;
}

/** Terrain level sampled for line heights (~300 m posts): cheap, and lines hug ridges well enough. */
export const INFRA_LINE_TERRAIN_LEVEL = 9;
/** Lines float this far above the sampled ground so terrain does not swallow them. */
export const INFRA_LINE_LIFT_M = 40;
/** Most vertices sampled for one view; above this the lines keep their stored vertices only. */
export const INFRA_MAX_SAMPLED_VERTICES = 40_000;

/**
 * Add vertices so no segment is longer than `stepDeg` (longitude scaled by latitude),
 * so terrain-sampled lines follow the ground between their simplified vertices.
 */
export function densifyLine(pts: ReadonlyArray<readonly [number, number]>, stepDeg = 0.03): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < pts.length; i++) {
    const [lng, lat] = pts[i];
    if (i > 0) {
      const [plng, plat] = pts[i - 1];
      const k = Math.cos((lat * Math.PI) / 180);
      const d = Math.hypot((lng - plng) * k, lat - plat);
      const n = Math.min(200, Math.floor(d / stepDeg));
      for (let j = 1; j <= n; j++) {
        const t = j / (n + 1);
        out.push([plng + (lng - plng) * t, plat + (lat - plat) * t]);
      }
    }
    out.push([lng, lat]);
  }
  return out;
}

/**
 * Infrastructure look per map style. NVG and thermal post-process the frame to
 * brightness only, so the warm-coloured lines and points vanish into lit terrain:
 * there they draw dark (black core, light rim) like the 3D models and camera cones.
 */
export interface InfraContrastStyle {
  /** Point fill override (null keeps each kind's colour). */
  pointFill: string | null;
  pointOutline: string;
  pointOutlineWidth: number;
  /** Line colour override (null keeps the voltage colour). */
  lineColor: string | null;
  lineAlpha: number;
  lineWidthBoost: number;
  labelFill: string | null;
  labelOutline: string;
}
export function infraContrastStyle(highContrast: boolean): InfraContrastStyle {
  return highContrast
    ? { pointFill: "#000000", pointOutline: "#ffffff", pointOutlineWidth: 2, lineColor: "#000000", lineAlpha: 0.95, lineWidthBoost: 1.5, labelFill: "#000000", labelOutline: "#ffffff" }
    : { pointFill: null, pointOutline: "#000000", pointOutlineWidth: 1, lineColor: null, lineAlpha: 0.85, lineWidthBoost: 0, labelFill: null, labelOutline: "#000000" };
}
