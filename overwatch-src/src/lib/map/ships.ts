/**
 * Live AIS ships for the Air & Sea layer (pure helpers, unit-tested).
 *
 * Data: public.ships, filled every minute by the ais-collector Edge function
 * (aisstream.io + Fintraffic Digitraffic), read with the ships_in_bbox RPC
 * (any signed-in user). The query box follows the camera like aircraft (#108)
 * but allows a wider span because the read is one indexed DB query.
 */
import type { GeoBox } from "./aircraft-viewport";
import { viewCenter } from "./aircraft-viewport";
import { distanceM } from "./aircraft-motion";

export interface Ship {
  mmsi: number; lat: number; lon: number;
  sog: number | null; cog: number | null; heading: number | null; nav_status: number | null;
  name: string | null; callsign: string | null; ship_type: number | null; length_m: number | null;
  destination: string | null; source: "aisstream" | "digitraffic"; updated_at: string;
}

export const SHIP_MAX_SPAN_DEG = 30;
export const SHIP_SNAP_DEG = 1;
export const SHIP_POLL_MS = 45_000;
export const SHIP_POLL_MS_PHONE = 60_000;
/** Max ships drawn per view. */
export const SHIP_CAP_DESKTOP = 2000;
export const SHIP_CAP_PHONE = 500;
/** 3D ship models (desktop): only near the camera, capped by governor level. */
export const SHIP_MODEL_NEAR_M = 25_000;
export const SHIP_MODEL_MAX_CAMERA_M = 60_000;
export const SHIP_MODEL_CAP_BY_LEVEL = [30, 10, 0] as const;
export const SHIP_MODEL_URL = "/overwatch/models/ship.glb";
/** ship.glb faces Cesium heading 0 with no offset (live check 2026-10-19: 90° showed ships broadside). */
export const SHIP_MODEL_HEADING_OFFSET_DEG = 0;
/** ship.glb is ~4000 model units long; scale to the AIS length (default 150 m), clamped. */
export const SHIP_MODEL_UNITS_LONG = 4000;
export function shipModelScale(lengthM: number | null | undefined): number {
  const len = lengthM && lengthM > 5 && lengthM <= 450 ? lengthM : 150;
  return Math.max(20, len) / SHIP_MODEL_UNITS_LONG;
}
export const SHIP_CREDIT = "AIS: aisstream.io · Fintraffic Digitraffic (CC BY 4.0)";

const MAX_LAT = 85;
const clampLat = (v: number) => Math.max(-MAX_LAT, Math.min(MAX_LAT, v));
const wrapLng = (v: number) => ((((v + 180) % 360) + 360) % 360) - 180;

/** RPC box for the current view: snapped to 1°, at most SHIP_MAX_SPAN_DEG per axis (centred on the view when wider). */
export function shipQueryBox(view: GeoBox | null, fallback: { lat: number; lng: number }): GeoBox {
  const span = SHIP_MAX_SPAN_DEG, step = SHIP_SNAP_DEG;
  const eastOf = (w: number, width: number) => (w + width > 180 ? w + width - 360 : w + width);
  const around = (lat: number, lng: number): GeoBox => {
    let south = clampLat(Math.floor((lat - span / 2) / step) * step);
    const north = clampLat(south + span);
    if (north - south < span) south = clampLat(north - span);
    const west = wrapLng(Math.floor((lng - span / 2) / step) * step);
    return { south, north, west, east: eastOf(west, span) };
  };
  const valid = view && [view.south, view.north, view.west, view.east].every(Number.isFinite) && view.north > view.south;
  if (!valid) return around(fallback.lat, fallback.lng);
  const crosses = view.east < view.west;
  const lngSpan = crosses ? view.east + 360 - view.west : view.east - view.west;
  if (lngSpan <= span && view.north - view.south <= span) {
    const south = clampLat(Math.floor(view.south / step) * step), north = clampLat(Math.ceil(view.north / step) * step);
    const west = Math.max(-180, Math.floor(view.west / step) * step), east = Math.min(180, Math.ceil(view.east / step) * step);
    return { south, north, west, east };
  }
  const c = viewCenter(view);
  return around(c.lat, c.lng);
}

/** Is a point inside a (possibly antimeridian-crossing, west > east) box? */
export function inShipBox(b: GeoBox, lat: number, lng: number): boolean {
  if (lat < b.south || lat > b.north) return false;
  return b.west <= b.east ? lng >= b.west && lng <= b.east : lng >= b.west || lng <= b.east;
}

export type ShipCategory = "cargo" | "tanker" | "passenger" | "fishing" | "tug" | "pleasure" | "highspeed" | "military" | "sar" | "other";

/** AIS ship type code (ITU-R M.1371) → category. */
export function shipCategory(type: number | null | undefined): ShipCategory {
  const t = Number(type ?? 0);
  if (t >= 70 && t <= 79) return "cargo";
  if (t >= 80 && t <= 89) return "tanker";
  if (t >= 60 && t <= 69) return "passenger";
  if (t === 30) return "fishing";
  if (t === 31 || t === 32 || t === 52) return "tug";
  if (t === 36 || t === 37) return "pleasure";
  if (t >= 40 && t <= 49) return "highspeed";
  if (t === 35) return "military";
  if (t === 51) return "sar";
  return "other";
}

export const CATEGORY_COLOR: Record<ShipCategory, string> = {
  cargo: "#4ade80", tanker: "#f87171", passenger: "#60a5fa", fishing: "#fbbf24", tug: "#2dd4bf",
  pleasure: "#e879f9", highspeed: "#facc15", military: "#a3e635", sar: "#fb923c", other: "#cbd5e1",
};
export const CATEGORY_LABEL: Record<ShipCategory, string> = {
  cargo: "Cargo", tanker: "Tanker", passenger: "Passenger", fishing: "Fishing", tug: "Tug / tow", pleasure: "Pleasure craft",
  highspeed: "High-speed craft", military: "Military", sar: "Search & rescue", other: "Other / unknown",
};

const NAV_STATUS: Record<number, string> = {
  0: "Under way (engine)", 1: "At anchor", 2: "Not under command", 3: "Restricted manoeuvrability", 4: "Constrained by draught",
  5: "Moored", 6: "Aground", 7: "Fishing", 8: "Under way (sail)", 14: "AIS-SART active",
};
export const navStatusLabel = (n: number | null | undefined) => (n == null ? null : NAV_STATUS[n] ?? null);

/** Direction the icon/model points: true heading, else course when moving, else 0. */
export function shipHeadingDeg(s: Pick<Ship, "heading" | "cog" | "sog">): number {
  if (s.heading != null) return s.heading;
  if (s.cog != null && (s.sog ?? 0) >= 0.5) return s.cog;
  return 0;
}

/** Ships to draw: newest first within the box, capped. */
export function capShips(ships: readonly Ship[], cap: number): Ship[] {
  return ships.length <= cap ? [...ships] : [...ships].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, cap);
}

/** Ship ids that get a 3D model: nearest within SHIP_MODEL_NEAR_M of the camera ground point, capped by governor level. */
export function selectShipModelIds(camera: { lat: number; lng: number; heightM: number }, ships: readonly Pick<Ship, "mmsi" | "lat" | "lon">[], level = 0): number[] {
  const cap = SHIP_MODEL_CAP_BY_LEVEL[Math.max(0, Math.min(2, level))];
  if (cap === 0 || camera.heightM > SHIP_MODEL_MAX_CAMERA_M) return [];
  return ships
    .map((s) => ({ id: s.mmsi, d: Math.hypot(distanceM(camera, { lat: s.lat, lng: s.lon }), camera.heightM) }))
    .filter((x) => x.d <= SHIP_MODEL_NEAR_M)
    .sort((a, b) => a.d - b.d)
    .slice(0, cap)
    .map((x) => x.id);
}

export const shipModelHeadingDeg = (h: number) => (((h + SHIP_MODEL_HEADING_OFFSET_DEG) % 360) + 360) % 360;
