/**
 * Pure helpers for ais-collector (no Deno/network), unit-tested in lib_test.ts.
 *
 * Sources:
 *  - aisstream.io WebSocket (global, free key in AISSTREAM_API_KEY). Docs:
 *    https://aisstream.io/documentation : server-side only, bbox required,
 *    subscribe within 3 s, max 3 connections, use permessage-deflate.
 *  - Fintraffic Digitraffic REST (Finland/Baltic, keyless, CC BY 4.0):
 *    https://meri.digitraffic.fi/api/ais/v1/locations
 */

export interface ShipRow {
  mmsi: number; lat: number; lon: number;
  sog?: number | null; cog?: number | null; heading?: number | null; nav_status?: number | null;
  name?: string | null; callsign?: string | null; ship_type?: number | null; length_m?: number | null;
  destination?: string | null;
  source: "aisstream" | "digitraffic";
  ts?: string;
}
export interface StaticRow { mmsi: number; name?: string | null; callsign?: string | null; ship_type?: number | null; length_m?: number | null; destination?: string | null }

export const AISSTREAM_URL = "wss://stream.aisstream.io/v0/stream";
export const DIGITRAFFIC_LOCATIONS = "https://meri.digitraffic.fi/api/ais/v1/locations";
export const DIGITRAFFIC_VESSELS = "https://meri.digitraffic.fi/api/ais/v1/vessels";
export const DIGITRAFFIC_USER = "Evenfall-Overwatch/1.0";

/** Stream window and caps (CPU limit is 2 s per request, so parsing is bounded). */
export const STREAM_MS = 40_000;
export const MESSAGE_CAP = 4_000;
/** aisstream world box: [[lat, lon], [lat, lon]]. */
export const WORLD_BOX: [[number, number], [number, number]][] = [[[-90, -180], [90, 180]]];
export const STREAM_TYPES = ["PositionReport", "StandardClassBPositionReport", "ExtendedClassBPositionReport", "ShipStaticData"];

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  // AIS pads text with '@' and spaces.
  const s = v.trim().replace(/@+$/, "").trim();
  return s ? s.slice(0, max) : null;
};
export const validMmsi = (m: unknown): m is number => typeof m === "number" && Number.isInteger(m) && m >= 100_000_000 && m <= 999_999_999;
export const validPos = (lat: unknown, lon: unknown) =>
  typeof lat === "number" && typeof lon === "number" && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && !(lat === 0 && lon === 0) && Math.abs(lat) !== 91 && Math.abs(lon) !== 181;
/** AIS "not available" values: SOG 102.3, COG 360, heading 511. */
const sog = (v: unknown) => { const n = num(v); return n == null || n >= 102.3 || n < 0 ? null : n; };
const cog = (v: unknown) => { const n = num(v); return n == null || n >= 360 || n < 0 ? null : n; };
const hdg = (v: unknown) => { const n = num(v); return n == null || n > 359 || n < 0 ? null : Math.round(n); };

export function subscription(apiKey: string) {
  return { APIKey: apiKey, BoundingBoxes: WORLD_BOX, FilterMessageTypes: STREAM_TYPES };
}

/** Parse one aisstream message (already JSON-decoded). Returns a position, a static update, or null. */
// deno-lint-ignore no-explicit-any
export function parseAisstream(msg: any, nowIso: string): { pos?: ShipRow; stat?: StaticRow } | null {
  const type = msg?.MessageType;
  const meta = msg?.MetaData ?? {};
  const body = type ? msg?.Message?.[type] : null;
  if (!body) return null;
  const mmsi = body.UserID ?? meta.MMSI;
  if (!validMmsi(mmsi)) return null;
  if (type === "ShipStaticData") {
    const d = body.Dimension ?? {};
    const len = (num(d.A) ?? 0) + (num(d.B) ?? 0);
    return { stat: { mmsi, name: str(body.Name, 40), callsign: str(body.CallSign, 12), ship_type: num(body.Type), length_m: len > 0 && len <= 600 ? len : null, destination: str(body.Destination, 40) } };
  }
  if (body.Valid === false) return null;
  const lat = body.Latitude ?? meta.latitude ?? meta.Latitude;
  const lon = body.Longitude ?? meta.longitude ?? meta.Longitude;
  if (!validPos(lat, lon)) return null;
  return {
    pos: {
      mmsi, lat, lon, sog: sog(body.Sog), cog: cog(body.Cog), heading: hdg(body.TrueHeading),
      nav_status: num(body.NavigationalStatus), name: str(meta.ShipName, 40), source: "aisstream", ts: nowIso,
    },
  };
}

/** Digitraffic /locations GeoJSON → rows. Feature time is properties.timestampExternal (ms). */
// deno-lint-ignore no-explicit-any
export function parseDigitrafficLocations(fc: any, nowMs: number, maxAgeMs = 15 * 60_000): ShipRow[] {
  const out: ShipRow[] = [];
  for (const f of fc?.features ?? []) {
    const p = f?.properties ?? {};
    const [lon, lat] = f?.geometry?.coordinates ?? [];
    const mmsi = p.mmsi ?? f?.mmsi;
    if (!validMmsi(mmsi) || !validPos(lat, lon)) continue;
    const t = num(p.timestampExternal);
    if (t == null || nowMs - t > maxAgeMs || t > nowMs + 60_000) continue;
    out.push({ mmsi, lat, lon, sog: sog(p.sog), cog: cog(p.cog), heading: hdg(p.heading), nav_status: num(p.navStat), source: "digitraffic", ts: new Date(t).toISOString() });
  }
  return out;
}

/** Digitraffic /vessels metadata → static rows. */
// deno-lint-ignore no-explicit-any
export function parseDigitrafficVessels(list: any): StaticRow[] {
  const out: StaticRow[] = [];
  for (const v of Array.isArray(list) ? list : []) {
    if (!validMmsi(v?.mmsi)) continue;
    const len = (num(v.referencePointA) ?? 0) + (num(v.referencePointB) ?? 0);
    out.push({ mmsi: v.mmsi, name: str(v.name, 40), callsign: str(v.callSign, 12), ship_type: num(v.shipType), length_m: len > 0 && len <= 600 ? len : null, destination: str(v.destination, 40) });
  }
  return out;
}

/** Last fix per MMSI wins; static fields from position messages never erase known ones. */
export class ShipBuffer {
  readonly pos = new Map<number, ShipRow>();
  readonly stat = new Map<number, StaticRow>();
  messages = 0;
  addPos(r: ShipRow) { const prev = this.pos.get(r.mmsi); this.pos.set(r.mmsi, prev?.name && !r.name ? { ...r, name: prev.name } : r); }
  addStat(s: StaticRow) { this.stat.set(s.mmsi, { ...this.stat.get(s.mmsi), ...Object.fromEntries(Object.entries(s).filter(([, v]) => v != null)) } as StaticRow); }
  /** Positions with any known static fields merged in. */
  rows(): ShipRow[] {
    return [...this.pos.values()].map((r) => { const s = this.stat.get(r.mmsi); return s ? { ...s, ...r, name: r.name ?? s.name ?? null } : r; });
  }
  /** Static rows for ships we have no position for this run (updates rows already in the table). */
  staticOnly(): StaticRow[] { return [...this.stat.values()].filter((s) => !this.pos.has(s.mmsi)); }
}

/** Decode a WebSocket frame payload (aisstream sends binary frames with UTF-8 JSON). */
export function decodeFrame(data: unknown): string | null {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (data instanceof Uint8Array) return new TextDecoder().decode(data);
  return null;
}
