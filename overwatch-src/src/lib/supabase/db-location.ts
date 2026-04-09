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
 * Push a GPS position for the current user (upserts).
 */
export async function pushStaffLocation(update: LocationUpdate) {
  const supabase = createClient();
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
    console.error("[Location] Fetch failed:", error);
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

  // Push to DB every 30 seconds
  intervalId = setInterval(() => {
    if (lastPosition) {
      pushStaffLocation({
        userId,
        companyId,
        lat: lastPosition.coords.latitude,
        lng: lastPosition.coords.longitude,
        accuracy: lastPosition.coords.accuracy ?? undefined,
        heading: lastPosition.coords.heading ?? undefined,
        speed: lastPosition.coords.speed ?? undefined,
      });
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
