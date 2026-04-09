/**
 * Environmental Intelligence — nearby POIs, sun position, geofence alerts.
 * All data fetched from free APIs (no keys required).
 */

// ─── Nearby POIs via Overpass API (OpenStreetMap) ─────────────

export interface NearbyPOI {
  id: number;
  type: "hospital" | "police" | "fire_station" | "pharmacy";
  name: string;
  lat: number;
  lng: number;
  distance?: number;
}

const POI_QUERIES: Record<NearbyPOI["type"], string> = {
  hospital: '[amenity=hospital]',
  police: '[amenity=police]',
  fire_station: '[amenity=fire_station]',
  pharmacy: '[amenity=pharmacy]',
};

export async function getNearbyPOIs(lat: number, lng: number, radiusM = 5000): Promise<NearbyPOI[]> {
  const bbox = getBBox(lat, lng, radiusM);
  const filters = Object.entries(POI_QUERIES)
    .map(([type, query]) => `node${query}(${bbox});way${query}(${bbox});`)
    .join("");

  const query = `[out:json][timeout:10];(${filters});out center 50;`;

  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();

    return (data.elements ?? []).map((el: Record<string, unknown>) => {
      const elLat = (el.lat ?? (el.center as Record<string, number>)?.lat) as number;
      const elLng = (el.lon ?? (el.center as Record<string, number>)?.lon) as number;
      const tags = el.tags as Record<string, string> ?? {};
      const amenity = tags.amenity as NearbyPOI["type"];
      return {
        id: el.id as number,
        type: amenity,
        name: tags.name || amenity.replace("_", " "),
        lat: elLat,
        lng: elLng,
      };
    }).filter((p: NearbyPOI) => p.lat && p.lng);
  } catch (err) {
    console.warn("[EnvIntel] POI fetch failed:", err);
    return [];
  }
}

// ─── Sun / Moon Position ──────────────────────────────────────

export interface SunPosition {
  azimuth: number; // degrees from north
  altitude: number; // degrees above horizon (negative = below)
  isDay: boolean;
  phase: "night" | "twilight" | "golden-hour" | "day";
}

export function getSunPosition(lat: number, lng: number, date = new Date()): SunPosition {
  // Simplified solar position calculation
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60;

  const declination = -23.45 * Math.cos((360 / 365) * (dayOfYear + 10) * Math.PI / 180);
  const hourAngle = (hour - 12) * 15 + lng;

  const latRad = lat * Math.PI / 180;
  const decRad = declination * Math.PI / 180;
  const haRad = hourAngle * Math.PI / 180;

  const altitude = Math.asin(
    Math.sin(latRad) * Math.sin(decRad) +
    Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad)
  ) * 180 / Math.PI;

  const azimuth = Math.atan2(
    Math.sin(haRad),
    Math.cos(haRad) * Math.sin(latRad) - Math.tan(decRad) * Math.cos(latRad)
  ) * 180 / Math.PI + 180;

  const isDay = altitude > 0;
  const phase: SunPosition["phase"] =
    altitude < -6 ? "night" :
    altitude < 0 ? "twilight" :
    altitude < 10 ? "golden-hour" : "day";

  return { azimuth: azimuth % 360, altitude, isDay, phase };
}

// ─── Geofence Alert Feed ──────────────────────────────────────

export interface GeofenceAlert {
  id: string;
  eventName: string;
  userName: string;
  distanceM: number;
  alertType: "breach" | "return";
  createdAt: string;
}

export async function getRecentGeofenceAlerts(companyId: string, limit = 20): Promise<GeofenceAlert[]> {
  const { createClient } = await import("./../../lib/supabase/client");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("geofence_alerts")
    .select("*, events(name), users(first_name, last_name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) { console.warn("[EnvIntel] Geofence alerts fetch failed:", error); return []; }

  return (data ?? []).map((r: Record<string, unknown> & { events?: { name?: string }; users?: { first_name?: string; last_name?: string } }) => ({
    id: r.id as string,
    eventName: r.events?.name ?? "Unknown",
    userName: `${r.users?.first_name ?? ""} ${r.users?.last_name ?? ""}`.trim() || "Unknown",
    distanceM: r.distance_m as number,
    alertType: r.alert_type as "breach" | "return",
    createdAt: r.created_at as string,
  }));
}

// ─── Helpers ──────────────────────────────────────────────────

function getBBox(lat: number, lng: number, radiusM: number): string {
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.cos(lat * Math.PI / 180));
  return `${lat - dLat},${lng - dLng},${lat + dLat},${lng + dLng}`;
}
