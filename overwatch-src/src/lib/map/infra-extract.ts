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
  if (kind === "s" && extra && Number(extra) > 0) detail = `${label} · ${extra} kV`;
  if (kind === "m" && extra) {
    const [cls, id] = extra.split("|");
    detail = MILITARY_CLASS[cls] ?? label;
    const m = /^([nwr])(\d+)$/.exec(id ?? "");
    if (m) osmUrl = `https://www.openstreetmap.org/${OSM_TYPES[m[1]]}/${m[2]}`;
  }
  return { kind, lng, lat, name: String(name ?? label).slice(0, 80) || label, detail, osmUrl };
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
