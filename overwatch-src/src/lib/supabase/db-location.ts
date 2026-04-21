/**
 * Staff location tracking — real-time GPS positions for on-shift staff.
 *
 * Table: staff_locations
 *   user_id, company_id, lat, lng, accuracy, heading, speed, updated_at
 *   UNIQUE(user_id, company_id) — one position per user per company
 *
 * Positions are upserted while on shift and deleted on clock-out.
 */

import { createClient } from "./client";
import { ensureInternalUser } from "./db-helpers";
import { logger } from "@/lib/logger";
import { logDbReadError } from "./db-error";

/**
 * Check if the current user has location sharing enabled for this company.
 * Defaults to true if the column doesn't exist yet.
 */
export async function isLocationSharingEnabled(companyId: string): Promise<boolean> {
  const userId = await ensureInternalUser();
  if (!userId) return false;
  const supabase = createClient();
  const { data } = await supabase
    .from("company_memberships")
    .select("location_sharing")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .maybeSingle();
  return (data?.location_sharing as boolean) ?? true; // default true
}

interface LocationUpdate {
  userId: string;
  companyId: string;
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
}

/**
 * Push a GPS position for the current user (upserts current + appends to history).
 */
export async function pushStaffLocation(update: LocationUpdate) {
  const supabase = createClient();

  // Upsert current position (latest only)
  const { error } = await supabase.from("staff_locations").upsert(
    {
      user_id: update.userId,
      company_id: update.companyId,
      lat: update.lat,
      lng: update.lng,
      accuracy: update.accuracy ?? null,
      heading: update.heading ?? null,
      speed: update.speed ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,company_id" }
  );
  if (error) console.error("[Location] Push failed:", error);

  // Append to history (breadcrumb trail)
  supabase.from("staff_location_history").insert({
    user_id: update.userId,
    company_id: update.companyId,
    lat: update.lat,
    lng: update.lng,
    accuracy: update.accuracy ?? null,
    heading: update.heading ?? null,
    speed: update.speed ?? null,
  }).then(({ error: histErr }: { error: { message: string } | null }) => {
    if (histErr) console.warn("[Location] History append failed:", histErr.message);
  });
}

/**
 * Get location history (breadcrumb trail) for a specific user.
 * Returns positions from the last N hours, oldest first.
 */
export async function getLocationHistory(userId: string, companyId: string, hoursBack = 8): Promise<Array<{ lat: number; lng: number; speed: number | null; heading: number | null; recordedAt: string }>> {
  const supabase = createClient();
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("staff_location_history")
    .select("lat, lng, speed, heading, recorded_at")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: true });

  if (error) { logDbReadError("location history", error); return []; }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    lat: r.lat as number,
    lng: r.lng as number,
    speed: r.speed as number | null,
    heading: r.heading as number | null,
    recordedAt: r.recorded_at as string,
  }));
}

/**
 * Check if a position is outside any active operation's geofence.
 * Returns the first breached event, or null if within all geofences.
 */
export async function checkGeofenceBreach(
  companyId: string,
  lat: number,
  lng: number,
): Promise<{ eventId: string; eventName: string; distanceM: number; radiusM: number } | null> {
  const supabase = createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, name, location_lat, location_lng, geofence_radius_meters, status")
    .eq("company_id", companyId)
    .not("geofence_radius_meters", "is", null)
    .gt("geofence_radius_meters", 0)
    .in("status", ["active", "upcoming"]);

  if (!events || events.length === 0) return null;

  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters

  for (const ev of events) {
    if (!ev.location_lat || !ev.location_lng) continue;
    const dLat = toRad(lat - ev.location_lat);
    const dLng = toRad(lng - ev.location_lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(ev.location_lat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
    const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    if (distance > (ev.geofence_radius_meters ?? 0)) {
      return { eventId: ev.id, eventName: ev.name, distanceM: distance, radiusM: ev.geofence_radius_meters ?? 0 };
    }
  }
  return null;
}

/**
 * Log a geofence breach alert.
 */
export async function logGeofenceBreach(
  companyId: string, eventId: string, userId: string,
  lat: number, lng: number, distanceM: number, alertType: "breach" | "return" = "breach"
) {
  const supabase = createClient();
  await supabase.from("geofence_alerts").insert({
    company_id: companyId,
    event_id: eventId,
    user_id: userId,
    alert_type: alertType,
    lat, lng,
    distance_m: distanceM,
  });
}

/**
 * Get the last known position for each staff member at a specific point in time.
 * Used by Time Machine to replay historical staff positions.
 */
export async function getStaffLocationsAt(companyId: string, timestamp: number): Promise<Array<{
  userId: string;
  name: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  updatedAt: string;
}>> {
  const supabase = createClient();
  const atTime = new Date(timestamp).toISOString();
  // Get all distinct user_ids who had history entries before the timestamp
  const { data: history, error } = await supabase
    .from("staff_location_history")
    .select("user_id, lat, lng, heading, speed, recorded_at, users(first_name, last_name)")
    .eq("company_id", companyId)
    .lte("recorded_at", atTime)
    .gte("recorded_at", new Date(timestamp - 8 * 60 * 60 * 1000).toISOString()) // Only look back 8h
    .order("recorded_at", { ascending: false })
    .limit(500);

  if (error) { logDbReadError("staff locations at time", error); return []; }
  if (!history?.length) return [];

  // Group by user_id and take the most recent entry (first due to desc order)
  const seen = new Set<string>();
  const results: Array<{
    userId: string; name: string; lat: number; lng: number;
    heading: number | null; speed: number | null; updatedAt: string;
  }> = [];
  for (const row of history as Array<Record<string, unknown> & { users?: { first_name?: string; last_name?: string } }>) {
    const uid = row.user_id as string;
    if (seen.has(uid)) continue;
    seen.add(uid);
    results.push({
      userId: uid,
      name: `${row.users?.first_name ?? ""} ${row.users?.last_name ?? ""}`.trim() || "Unknown",
      lat: row.lat as number,
      lng: row.lng as number,
      heading: row.heading as number | null,
      speed: row.speed as number | null,
      updatedAt: row.recorded_at as string,
    });
  }
  return results;
}

/**
 * Get location history for a user up to a specific timestamp (for Time Machine breadcrumbs).
 */
export async function getLocationHistoryAt(
  userId: string, companyId: string, hoursBack: number, upToTimestamp: number
): Promise<Array<{ lat: number; lng: number; speed: number | null; heading: number | null; recordedAt: string }>> {
  const supabase = createClient();
  const atTime = new Date(upToTimestamp).toISOString();
  const since = new Date(upToTimestamp - hoursBack * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("staff_location_history")
    .select("lat, lng, speed, heading, recorded_at")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .gte("recorded_at", since)
    .lte("recorded_at", atTime)
    .order("recorded_at", { ascending: true });

  if (error) { logDbReadError("location history at time", error); return []; }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    lat: r.lat as number,
    lng: r.lng as number,
    speed: r.speed as number | null,
    heading: r.heading as number | null,
    recordedAt: r.recorded_at as string,
  }));
}

/**
 * Remove the current user's location (called on clock-out).
 */
export async function clearStaffLocation(userId: string, companyId: string) {
  const supabase = createClient();
  await supabase
    .from("staff_locations")
    .delete()
    .eq("user_id", userId)
    .eq("company_id", companyId);
}

/**
 * Get all active staff locations for a company.
 */
export async function getStaffLocations(companyId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("staff_locations")
    .select("*, users(first_name, last_name)")
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false });

  if (error) {
    logDbReadError("staff locations", error);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown> & { users?: { first_name?: string; last_name?: string } }) => ({
    userId: row.user_id as string,
    name: `${row.users?.first_name ?? ""} ${row.users?.last_name ?? ""}`.trim() || "Unknown",
    lat: row.lat as number,
    lng: row.lng as number,
    accuracy: row.accuracy as number | null,
    heading: row.heading as number | null,
    speed: row.speed as number | null,
    updatedAt: row.updated_at as string,
  }));
}

/**
 * Subscribe to real-time staff location changes for a company.
 * Returns an unsubscribe function.
 */
export function subscribeStaffLocations(
  companyId: string,
  onUpdate: () => void,
): () => void {
  const supabase = createClient();
  const channel = supabase
    .channel(`staff-locations-${companyId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "staff_locations",
        filter: `company_id=eq.${companyId}`,
      },
      () => onUpdate()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Start the browser Geolocation watcher. Pushes updates every 30 seconds.
 * Returns a stop function.
 */
export function startLocationWatcher(
  userId: string,
  companyId: string,
): () => void {
  let watchId: number | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let lastPosition: GeolocationPosition | null = null;

  if (!navigator.geolocation) {
    console.warn("[Location] Geolocation not available");
    return () => {};
  }

  // Watch position continuously
  watchId = navigator.geolocation.watchPosition(
    (pos) => { lastPosition = pos; },
    (err) => console.warn("[Location] Geolocation error:", err.message),
    { enableHighAccuracy: true, maximumAge: 10000 }
  );

  // Push to DB every 30 seconds + check geofences
  let lastBreachEventId: string | null = null;
  intervalId = setInterval(async () => {
    if (lastPosition) {
      const lat = lastPosition.coords.latitude;
      const lng = lastPosition.coords.longitude;

      pushStaffLocation({
        userId, companyId, lat, lng,
        accuracy: lastPosition.coords.accuracy ?? undefined,
        heading: lastPosition.coords.heading ?? undefined,
        speed: lastPosition.coords.speed ?? undefined,
      });

      // Check geofence breaches
      try {
        const breach = await checkGeofenceBreach(companyId, lat, lng);
        if (breach && breach.eventId !== lastBreachEventId) {
          // New breach — log it
          lastBreachEventId = breach.eventId;
          logGeofenceBreach(companyId, breach.eventId, userId, lat, lng, breach.distanceM, "breach");
          console.warn(`[Geofence] BREACH: ${breach.eventName} — ${Math.round(breach.distanceM)}m outside ${breach.radiusM}m radius`);
        } else if (!breach && lastBreachEventId) {
          // Returned inside geofence
          lastBreachEventId = null;
        }
      } catch (e) { logger.swallow("db-location:geofence-check", e, "warn"); }
    }
  }, 30000);

  // Push immediately on first position
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      lastPosition = pos;
      pushStaffLocation({
        userId,
        companyId,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? undefined,
        heading: pos.coords.heading ?? undefined,
        speed: pos.coords.speed ?? undefined,
      });
    },
    () => {},
    { enableHighAccuracy: true }
  );

  return () => {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    if (intervalId !== null) clearInterval(intervalId);
    clearStaffLocation(userId, companyId);
  };
}
