/** Nearby aircraft for the tracking chip's contact list. */
import { distanceM, norm360 } from "./aircraft-motion";

export const CONTACT_RADIUS_M = 250_000;
export const CONTACT_LIST_MAX = 15;

export interface ContactLike { icao24: string; callsign: string; lat: number; lng: number; altitude: number; onGround?: boolean; military?: boolean; emergency?: boolean }
export interface Contact<T extends ContactLike> { item: T; distanceM: number; bearingDeg: number }

const DEG = Math.PI / 180;
export function bearingDeg(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const y = Math.sin((b.lng - a.lng) * DEG) * Math.cos(b.lat * DEG);
  const x = Math.cos(a.lat * DEG) * Math.sin(b.lat * DEG) - Math.sin(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.cos((b.lng - a.lng) * DEG);
  return norm360(Math.atan2(y, x) / DEG);
}

export function compass(deg: number): string {
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(norm360(deg) / 45) % 8];
}

/** Aircraft within `radiusM` of `origin`, nearest first; emergencies float to the top. */
export function nearbyContacts<T extends ContactLike>(
  origin: { lat: number; lng: number }, list: readonly T[], excludeId?: string,
  radiusM = CONTACT_RADIUS_M, max = CONTACT_LIST_MAX,
): Contact<T>[] {
  const out: Contact<T>[] = [];
  for (const a of list) {
    if (a.icao24 === excludeId || !Number.isFinite(a.lat) || !Number.isFinite(a.lng)) continue;
    const d = distanceM(origin, a);
    if (d <= radiusM) out.push({ item: a, distanceM: d, bearingDeg: bearingDeg(origin, a) });
  }
  out.sort((x, y) => (Number(Boolean(y.item.emergency)) - Number(Boolean(x.item.emergency))) || x.distanceM - y.distanceM);
  return out.slice(0, max);
}
