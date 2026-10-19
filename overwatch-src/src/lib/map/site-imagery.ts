/**
 * Dated satellite imagery for one site: NASA Harmonized Landsat Sentinel-2
 * (HLS, 30 m) days from the NASA CMR granule catalog, drawn from NASA GIBS
 * tiles and bounded to a box around the site. Everything is U.S. public
 * domain (NASA), keyless and browser-direct (CORS *).
 *
 * Product table, CMR query shape and the GIBS URL pattern are ported from
 * gods-eye-view src/layers/recentImagery (MIT, © 2026 Bilawal Sidhu),
 * trimmed to a fixed site box. Pure helpers only (no Cesium, no fetch).
 */

export type HlsProduct = "S30" | "L30";

export const HLS_PRODUCTS: Record<HlsProduct, { label: string; gibsLayer: string; cmrCollection: string; maxLevel: number }> = {
  S30: { label: "Sentinel-2", gibsLayer: "HLS_S30_Nadir_BRDF_Adjusted_Reflectance", cmrCollection: "C2021957295-LPCLOUD", maxLevel: 12 },
  L30: { label: "Landsat 8/9", gibsLayer: "HLS_L30_Nadir_BRDF_Adjusted_Reflectance", cmrCollection: "C2021957657-LPCLOUD", maxLevel: 12 },
};

export const CMR_SEARCH = "https://cmr.earthdata.nasa.gov/search/granules.umm_json";
/** How far back the site catalog looks. */
export const SITE_IMAGERY_DAYS = 90;
/** Side of the box searched and drawn around a site. */
export const SITE_BOX_KM = 12;
export const GIBS_ACK =
  "Imagery: NASA GIBS / ESDIS · HLS (Landsat 8/9, Sentinel-2) · public domain";

export interface SiteBox { west: number; south: number; east: number; north: number }

const KM_PER_DEG = 111.32;
/** Web-Mercator GIBS tiles stop here. */
const MERC_LIMIT = 85;

/** Square box of `sideKm` centred on a site, clamped to the GIBS range. Null if unusable. */
export function siteBox(lat: number, lng: number, sideKm = SITE_BOX_KM): SiteBox | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > MERC_LIMIT || Math.abs(lng) > 180) return null;
  const dLat = sideKm / 2 / KM_PER_DEG;
  const dLng = sideKm / 2 / (KM_PER_DEG * Math.max(0.05, Math.cos((lat * Math.PI) / 180)));
  const r = (n: number) => Math.round(n * 1e4) / 1e4;
  const box = {
    west: r(Math.max(-180, lng - dLng)), east: r(Math.min(180, lng + dLng)),
    south: r(Math.max(-MERC_LIMIT, lat - dLat)), north: r(Math.min(MERC_LIMIT, lat + dLat)),
  };
  return box.west < box.east && box.south < box.north ? box : null;
}

/** CMR search URL for one HLS product over a box, newest first. */
export function cmrUrl(product: HlsProduct, box: SiteBox, now: Date = new Date(), days = SITE_IMAGERY_DAYS): string {
  const end = now.toISOString().replace(/\.\d{3}Z$/, "Z");
  const start = new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10) + "T00:00:00Z";
  return `${CMR_SEARCH}?collection_concept_id=${HLS_PRODUCTS[product].cmrCollection}`
    + `&bounding_box=${box.west},${box.south},${box.east},${box.north}`
    + `&temporal=${start},${end}&sort_key=-start_date&page_size=200`;
}

export interface HlsGranule { product: HlsProduct; day: string; cloud: number | null }

/** Parse a CMR granules.umm_json response. Rows without a start time are dropped. */
export function parseCmr(json: unknown, product: HlsProduct): HlsGranule[] {
  const items = (json as { items?: unknown[] } | null)?.items;
  if (!Array.isArray(items)) return [];
  const out: HlsGranule[] = [];
  for (const item of items) {
    const umm = (item as { umm?: Record<string, unknown> } | null)?.umm ?? {};
    const start = (umm.TemporalExtent as { RangeDateTime?: { BeginningDateTime?: unknown } } | undefined)?.RangeDateTime?.BeginningDateTime;
    if (typeof start !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(start) || Number.isNaN(Date.parse(start))) continue;
    const attrs = Array.isArray(umm.AdditionalAttributes) ? umm.AdditionalAttributes as Array<{ Name?: string; Values?: unknown[] }> : [];
    const raw = attrs.find((a) => a?.Name === "CLOUD_COVERAGE")?.Values?.[0];
    const cloud = raw === undefined || raw === null || raw === "" ? null : Number(raw);
    out.push({ product, day: start.slice(0, 10), cloud: Number.isFinite(cloud) ? Math.max(0, Math.min(100, cloud as number)) : null });
  }
  return out;
}

export interface ImageryDay {
  day: string;
  /** Product to draw: the clearest one that day (S30 wins ties, it is sharper in colour). */
  product: HlsProduct;
  products: HlsProduct[];
  /** Lowest scene cloud % across that day's granules, or null when unknown. */
  cloud: number | null;
}

/** Fold granules into one row per UTC day, newest first. */
export function imageryDays(granules: HlsGranule[]): ImageryDay[] {
  const byDay = new Map<string, HlsGranule[]>();
  for (const g of granules) {
    const list = byDay.get(g.day) ?? [];
    list.push(g);
    byDay.set(g.day, list);
  }
  const rows: ImageryDay[] = [];
  for (const [day, list] of byDay) {
    const products = ([...new Set(list.map((g) => g.product))] as HlsProduct[]).sort();
    const best = (p: HlsProduct) => {
      const c = list.filter((g) => g.product === p && g.cloud !== null).map((g) => g.cloud as number);
      return c.length ? Math.min(...c) : Infinity;
    };
    const product = products.length === 1 ? products[0] : (best("L30") < best("S30") ? "L30" : "S30");
    const clouds = list.map((g) => g.cloud).filter((c): c is number => c !== null);
    rows.push({ day, product, products, cloud: clouds.length ? Math.min(...clouds) : null });
  }
  return rows.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
}

/** Newest day at or under `maxCloud` %, else the newest day; null when none. */
export function pickDefaultDay(days: ImageryDay[], maxCloud = 20): ImageryDay | null {
  return days.find((d) => d.cloud !== null && d.cloud <= maxCloud) ?? days[0] ?? null;
}

/** GIBS WMTS tile template for an HLS product on a day. */
export function hlsTileUrl(product: HlsProduct, day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new TypeError("day must be YYYY-MM-DD");
  const p = HLS_PRODUCTS[product];
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${p.gibsLayer}/default/${day}/GoogleMapsCompatible_Level${p.maxLevel}/{z}/{y}/{x}.png`;
}

export function cloudLabel(cloud: number | null): string {
  return cloud === null ? "cloud ?" : `${Math.round(cloud)}% cloud`;
}
