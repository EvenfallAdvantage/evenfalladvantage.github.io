// Pure parsers for intel-cctv sources (unit-tested in lib_test.ts).

export interface CctvCamera {
  id: string;
  lat: number;
  lng: number;
  name: string;
  city: string;
  country: string;
  feed_url?: string;
  stream_url?: string;
  external_url?: string;
  source: string;
}

export const validLatLng = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/** Caltrans districts 1–12. Paths use the bare number ("d7"); file names zero-pad ("cctvStatusD07.json"). */
export const CALTRANS_DISTRICTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export function caltransUrl(district: number): string {
  return `https://cwwp2.dot.ca.gov/data/d${district}/cctv/cctvStatusD${String(district).padStart(2, "0")}.json`;
}

interface CaltransRecord {
  cctv?: {
    index?: string;
    inService?: string;
    location?: { latitude?: string; longitude?: string; locationName?: string; nearbyPlace?: string; county?: string };
    imageData?: { static?: { currentImageURL?: string } };
  };
}

export function parseCaltrans(body: unknown, district: number): CctvCamera[] {
  const rows = (body as { data?: CaltransRecord[] })?.data;
  if (!Array.isArray(rows)) return [];
  const out: CctvCamera[] = [];
  for (const r of rows) {
    const c = r?.cctv;
    if (!c || c.inService === "false") continue;
    const lat = parseFloat(c.location?.latitude ?? "");
    const lng = parseFloat(c.location?.longitude ?? "");
    const url = c.imageData?.static?.currentImageURL;
    if (!validLatLng(lat, lng) || !url || !url.startsWith("https://")) continue;
    out.push({
      id: `cal-d${district}-${c.index ?? out.length}`,
      lat, lng,
      name: c.location?.locationName ?? "Caltrans camera",
      city: c.location?.nearbyPlace || c.location?.county || "California",
      country: "US",
      feed_url: url,
      source: "Caltrans",
    });
  }
  return out;
}

interface NycRecord { id?: string; name?: string; latitude?: number; longitude?: number; area?: string; isOnline?: string | boolean; imageUrl?: string }

export function parseNyc(body: unknown): CctvCamera[] {
  if (!Array.isArray(body)) return [];
  const out: CctvCamera[] = [];
  for (const r of body as NycRecord[]) {
    if (!r?.id || String(r.isOnline) === "false") continue;
    const lat = Number(r.latitude), lng = Number(r.longitude);
    if (!validLatLng(lat, lng) || !r.imageUrl?.startsWith("https://")) continue;
    out.push({
      id: `nyc-${r.id}`,
      lat, lng,
      name: r.name ?? "NYC DOT camera",
      city: r.area ? `${r.area}, New York` : "New York",
      country: "US",
      feed_url: r.imageUrl,
      source: "NYC DOT",
    });
  }
  return out;
}

interface SgBody { items?: Array<{ cameras?: Array<{ camera_id?: string; location?: { latitude?: number; longitude?: number }; image?: string }> }> }

export function parseSingapore(body: unknown): CctvCamera[] {
  const cams = (body as SgBody)?.items?.[0]?.cameras ?? [];
  const out: CctvCamera[] = [];
  for (const cam of cams) {
    const lat = Number(cam.location?.latitude), lng = Number(cam.location?.longitude);
    if (!validLatLng(lat, lng) || !cam.image) continue;
    out.push({
      id: `sin-${cam.camera_id}`,
      lat, lng,
      name: `Camera ${cam.camera_id}`,
      city: "Singapore",
      country: "Singapore",
      feed_url: cam.image,
      source: "LTA Singapore",
    });
  }
  return out;
}
