// Parsers for the PR B no-key sources. Pure functions; tested in parsers_more_test.ts.
// Only https image URLs are kept (the app is served over https).
import { type CctvCamera, validLatLng } from "./parsers.ts";

const https = (u: unknown): string | undefined => (typeof u === "string" && u.startsWith("https://") ? u : undefined);
const num = (v: unknown) => (typeof v === "number" ? v : parseFloat(String(v ?? "")));
const str = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));

type EsriFeature = { attributes?: Record<string, unknown>; geometry?: { x?: number; y?: number } };
const esriFeatures = (body: unknown): EsriFeature[] => {
  const f = (body as { features?: EsriFeature[] })?.features;
  return Array.isArray(f) ? f : [];
};

/** Illinois — Travel Midwest ArcGIS FeatureServer (paged). */
export function parseIllinois(body: unknown): CctvCamera[] {
  const out: CctvCamera[] = [];
  for (const f of esriFeatures(body)) {
    const a = f.attributes ?? {};
    if (str(a.TooOld) === "true") continue;
    const lat = num(a.y ?? f.geometry?.y), lng = num(a.x ?? f.geometry?.x);
    const img = https(a.SnapShot);
    if (!validLatLng(lat, lng) || !img) continue;
    const dir = str(a.CameraDirection);
    out.push({
      id: `il-${a.OBJECTID ?? out.length}`, lat, lng,
      name: `${str(a.CameraLocation) || "Illinois camera"}${dir && dir !== "NONE" ? ` (${dir})` : ""}`,
      city: "Illinois", country: "US", feed_url: img, external_url: https(a.ImgPath), source: "Travel Midwest (IL)",
    });
  }
  return out;
}

/** Iowa DOT — ArcGIS FeatureServer (paged). Needs outSR=4326 or uses latitude/longitude attrs. */
export function parseIowa(body: unknown): CctvCamera[] {
  const out: CctvCamera[] = [];
  for (const f of esriFeatures(body)) {
    const a = f.attributes ?? {};
    const lat = num(a.latitude), lng = num(a.longitude);
    const img = https(a.ImageURL);
    if (!validLatLng(lat, lng) || !img) continue;
    out.push({
      // device_id is shared by several views of one device; the image name is unique per view.
      id: `ia-${img.split("/").pop()!.replace(/\.[a-z]+$/i, "")}`, lat, lng,
      name: str(a.Desc_) || str(a.ImageName) || "Iowa DOT camera",
      city: str(a.REGION) || "Iowa", country: "US", feed_url: img, stream_url: https(a.VideoURL), source: "Iowa DOT",
    });
  }
  return out;
}

/** Oregon — TripCheck cctvinventory (ESRI JSON). */
export function parseTripCheck(body: unknown): CctvCamera[] {
  const out: CctvCamera[] = [];
  for (const f of esriFeatures(body)) {
    const a = f.attributes ?? {};
    const lat = num(a.latitude), lng = num(a.longitude), file = str(a.filename);
    // Real names contain spaces/@/parentheses; only block path tricks (encoded below).
    if (!validLatLng(lat, lng) || !file || file.includes("/") || file.includes("\\") || file.includes("..")) continue;
    out.push({
      id: `or-${a.cameraId ?? file}`, lat, lng,
      name: str(a.title) || "TripCheck camera", city: str(a.route) || "Oregon", country: "US",
      feed_url: `https://tripcheck.com/RoadCams/cams/${encodeURIComponent(file)}`, source: "ODOT TripCheck",
    });
  }
  return out;
}

/** British Columbia — DriveBC /api/webcams/. */
export function parseDriveBC(body: unknown): CctvCamera[] {
  if (!Array.isArray(body)) return [];
  const out: CctvCamera[] = [];
  for (const r of body as Array<Record<string, unknown>>) {
    if (r.is_on === false || r.marked_stale === true) continue;
    const coords = (r.location as { coordinates?: unknown[] } | undefined)?.coordinates ?? [];
    const lng = num(coords[0]), lat = num(coords[1]);
    const img = str((r.links as { imageDisplay?: string } | undefined)?.imageDisplay);
    if (!validLatLng(lat, lng) || !img.startsWith("/")) continue;
    out.push({
      id: `bc-${r.id}`, lat, lng, name: str(r.name) || "DriveBC camera",
      city: str(r.region_name) || "British Columbia", country: "CA",
      feed_url: `https://www.drivebc.ca${img.split("?")[0]}`, external_url: `https://www.drivebc.ca/cameras/${r.id}`,
      source: "DriveBC",
    });
  }
  return out;
}

const xmlTag = (block: string, tag: string) => {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim().replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&") : "";
};

/** Hong Kong Transport Department — Traffic_Camera_Locations_En.xml. */
export function parseHongKong(xml: unknown): CctvCamera[] {
  if (typeof xml !== "string") return [];
  const out: CctvCamera[] = [];
  for (const m of xml.matchAll(/<image>([\s\S]*?)<\/image>/g)) {
    const b = m[1];
    const lat = num(xmlTag(b, "latitude")), lng = num(xmlTag(b, "longitude"));
    const img = https(xmlTag(b, "url")), key = xmlTag(b, "key");
    if (!validLatLng(lat, lng) || !img || !key) continue;
    out.push({
      id: `hk-${key}`, lat, lng, name: xmlTag(b, "description") || key,
      city: xmlTag(b, "district") || xmlTag(b, "region") || "Hong Kong", country: "HK", feed_url: img, source: "HK Transport Department",
    });
  }
  return out;
}

/** Austin, TX — City of Austin open data (Socrata b4k4-adkb). */
export function parseAustin(body: unknown): CctvCamera[] {
  if (!Array.isArray(body)) return [];
  const out: CctvCamera[] = [];
  for (const r of body as Array<Record<string, unknown>>) {
    if (r.camera_status !== "TURNED_ON") continue;
    const c = (r.location as { coordinates?: unknown[] } | undefined)?.coordinates ?? [];
    const lng = num(c[0]), lat = num(c[1]);
    const img = https(r.screenshot_address);
    if (!validLatLng(lat, lng) || !img) continue;
    out.push({
      id: `atx-${r.camera_id}`, lat, lng, name: str(r.location_name) || "Austin camera",
      city: "Austin, TX", country: "US", feed_url: img, source: "City of Austin",
    });
  }
  return out;
}

/** London — TfL JamCams (/Place/Type/JamCam). */
export function parseTfl(body: unknown): CctvCamera[] {
  if (!Array.isArray(body)) return [];
  const out: CctvCamera[] = [];
  for (const r of body as Array<Record<string, unknown>>) {
    const props = Array.isArray(r.additionalProperties) ? r.additionalProperties as Array<{ key?: string; value?: string }> : [];
    const prop = (k: string) => props.find((p) => p.key === k)?.value;
    if (prop("available") === "false") continue;
    const lat = num(r.lat), lng = num(r.lon), img = https(prop("imageUrl"));
    if (!validLatLng(lat, lng) || !img) continue;
    out.push({
      id: `tfl-${str(r.id).replace(/^JamCams_/, "")}`, lat, lng, name: str(r.commonName) || "TfL JamCam",
      city: "London", country: "GB", feed_url: img, stream_url: https(prop("videoUrl")), source: "TfL JamCams",
    });
  }
  return out;
}

/** New Zealand — NZTA Journeys cameras.json (GeoJSON). */
export function parseNzta(body: unknown): CctvCamera[] {
  const feats = (body as { features?: Array<{ properties?: Record<string, unknown> }> })?.features;
  if (!Array.isArray(feats)) return [];
  const out: CctvCamera[] = [];
  for (const f of feats) {
    const p = f.properties ?? {};
    if (num(p.Offline) === 1 || num(p.UnderMaintenance) === 1) continue;
    const lat = num(p.Latitude), lng = num(p.Longitude), img = https(p.ImageUrl);
    if (!validLatLng(lat, lng) || !img) continue;
    out.push({
      id: `nz-${p.ExternalId}`, lat, lng, name: str(p.Name) || "NZTA camera",
      city: str(p.Region) || "New Zealand", country: "NZ", feed_url: img, source: "NZTA",
    });
  }
  return out;
}

/** Fetch every page of an ArcGIS FeatureServer layer (WGS84). */
export async function fetchArcgisAll(
  get: (url: string, timeoutMs: number) => Promise<unknown | null>,
  layerUrl: string,
  pageSize = 2000,
  maxPages = 10,
): Promise<{ features: EsriFeature[] }> {
  const features: EsriFeature[] = [];
  // Servers cap pages at their own maxRecordCount, so advance by what came back.
  for (let page = 0, offset = 0; page < maxPages; page++) {
    const u = `${layerUrl}/query?where=1%3D1&outFields=*&outSR=4326&f=json&resultOffset=${offset}&resultRecordCount=${pageSize}`;
    const body = await get(u, 15_000) as { features?: EsriFeature[]; exceededTransferLimit?: boolean } | null;
    const f = body?.features ?? [];
    features.push(...f);
    offset += f.length;
    if (!body?.exceededTransferLimit || f.length === 0) break;
  }
  return { features };
}
