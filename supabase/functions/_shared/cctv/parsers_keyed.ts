// Parsers for Finland Digitraffic, NPS webcams and the shared 511 /api/v2/get/cameras
// family (GA, WI, ID, Ontario, Alberta). Pure functions; tested in parsers_keyed_test.ts.
import { type CctvCamera, validLatLng } from "./parsers.ts";

const https = (u: unknown): string | undefined => (typeof u === "string" && u.startsWith("https://") ? u : undefined);
const num = (v: unknown) => (typeof v === "number" ? v : parseFloat(String(v ?? "")));
const str = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));
const safeId = (v: unknown) => str(v).replace(/[^A-Za-z0-9_-]/g, "");

/** Finland — Digitraffic weathercam stations (GeoJSON). One row per active preset (camera view). */
export function parseDigitraffic(body: unknown): CctvCamera[] {
  const feats = (body as { features?: unknown[] })?.features;
  if (!Array.isArray(feats)) return [];
  const out: CctvCamera[] = [];
  for (const f of feats as Array<{ geometry?: { coordinates?: unknown[] }; properties?: Record<string, unknown> }>) {
    const p = f.properties ?? {};
    if (p.collectionStatus && p.collectionStatus !== "GATHERING") continue;
    const c = f.geometry?.coordinates ?? [];
    const lng = num(c[0]), lat = num(c[1]);
    if (!validLatLng(lat, lng)) continue;
    const presets = Array.isArray(p.presets) ? (p.presets as Array<{ id?: unknown; inCollection?: unknown }>) : [];
    for (const pr of presets) {
      const id = safeId(pr.id);
      if (!id || pr.inCollection === false) continue;
      out.push({
        id: `fi-${id}`, lat, lng, name: str(p.name).replace(/_/g, " ") || "Digitraffic camera",
        city: "Finland", country: "FI", feed_url: `https://weathercam.digitraffic.fi/${id}.jpg`, source: "Digitraffic (FI)",
      });
    }
  }
  return out;
}

/** US National Park Service — /api/v1/webcams. Keeps active cams with a location. */
export function parseNps(body: unknown): CctvCamera[] {
  const rows = (body as { data?: unknown[] })?.data;
  if (!Array.isArray(rows)) return [];
  const out: CctvCamera[] = [];
  for (const r of rows as Array<Record<string, unknown>>) {
    if (str(r.status) && str(r.status) !== "Active") continue;
    const lat = num(r.latitude), lng = num(r.longitude);
    if (!validLatLng(lat, lng)) continue;
    const imgs = Array.isArray(r.images) ? (r.images as Array<{ url?: unknown }>) : [];
    const page = https(r.url);
    const img = imgs.map((i) => https(i.url)).find(Boolean);
    if (!img && !page) continue;
    const park = (Array.isArray(r.relatedParks) ? r.relatedParks[0] : undefined) as { fullName?: unknown; states?: unknown } | undefined;
    out.push({
      id: `nps-${safeId(r.id)}`, lat, lng, name: str(r.title) || "NPS webcam",
      city: str(park?.fullName) || str(park?.states) || "US", country: "US",
      feed_url: img, external_url: page, source: "NPS Webcams",
    });
  }
  return out;
}

/**
 * 511 "/api/v2/get/cameras" family (Iteris/Castle Rock style: GA, WI, ID, Ontario, Alberta).
 * Handles both shapes: per-camera `Views[]` (newer) and flat `Url` (older).
 */
export function parse511(body: unknown, source: string, prefix: string, region: string, country: string): CctvCamera[] {
  if (!Array.isArray(body)) return [];
  const out: CctvCamera[] = [];
  for (const r of body as Array<Record<string, unknown>>) {
    const lat = num(r.Latitude), lng = num(r.Longitude);
    if (!validLatLng(lat, lng)) continue;
    const base = str(r.Location) || str(r.Name) || str(r.Roadway) || `${region} camera`;
    const views = Array.isArray(r.Views) ? (r.Views as Array<Record<string, unknown>>)
      : [{ Id: r.ID ?? r.Id, Url: r.Url, Status: r.Status, Description: "" }];
    views.forEach((v, i) => {
      const img = https(v.Url);
      if (!img || /disabled|offline/i.test(str(v.Status))) return;
      const vid = safeId(v.Id) || `${safeId(r.Id ?? r.ID)}-${i}`;
      const d = str(v.Description);
      out.push({
        id: `${prefix}-${vid}`, lat, lng, name: d && d !== base ? `${base} (${d})` : base,
        city: str(r.Roadway) || region, country, feed_url: img, source,
      });
    });
  }
  return out;
}

/** 511 hosts: id, secret name, API base, region label, country, id prefix, attribution. */
export const FIVE11 = [
  { id: "511 Georgia", secret: "GA511_API_KEY", host: "https://511ga.org", region: "Georgia", country: "US", prefix: "ga", attribution: "Georgia DOT 511GA" },
  { id: "511 Wisconsin", secret: "WI511_API_KEY", host: "https://511wi.gov", region: "Wisconsin", country: "US", prefix: "wi", attribution: "Wisconsin DOT 511WI" },
  { id: "511 Idaho", secret: "ID511_API_KEY", host: "https://511.idaho.gov", region: "Idaho", country: "US", prefix: "id", attribution: "Idaho Transportation Department 511" },
  { id: "511 Ontario", secret: "ONTARIO511_API_KEY", host: "https://511on.ca", region: "Ontario", country: "CA", prefix: "on", attribution: "Contains information licensed under the Open Government Licence – Ontario (Ontario 511)" },
  { id: "511 Alberta", secret: "ALBERTA511_API_KEY", host: "https://511.alberta.ca", region: "Alberta", country: "CA", prefix: "ab", attribution: "511 Alberta, Government of Alberta (Open Government Licence – Alberta)" },
] as const;

export const five11Url = (host: string, key: string) =>
  `${host}/api/v2/get/cameras?key=${encodeURIComponent(key)}&format=json`;
