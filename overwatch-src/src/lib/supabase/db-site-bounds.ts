import { createClient } from "./client";
import { logger } from "@/lib/logger";

// ─── Site Map Alignment Bounds ────────────────────────
//
// Persisted in the `site_map_bounds` table (one row per event, company-scoped
// RLS). localStorage is used as a fast first-paint cache so the same browser
// reload instantly drapes the imagery while the network read completes in
// the background.
//
// Important: prior to the May 2026 fix, this module wrote bounds to a
// non-existent `events.settings` JSONB column and the write was silently
// swallowed. Bounds only ever persisted on the aligning admin's browser.
// Existing localStorage entries are migrated to the DB on first save.

export interface SiteMapBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

function lsKey(eventId: string): string {
  return `site-map-bounds-${eventId}`;
}

function readLocalStorageBounds(eventId: string): SiteMapBounds | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const saved = localStorage.getItem(lsKey(eventId));
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== "object") return null;
    const b = parsed as SiteMapBounds;
    if (typeof b.west !== "number" || typeof b.south !== "number"
     || typeof b.east !== "number" || typeof b.north !== "number") return null;
    return b;
  } catch (e) {
    logger.swallow("db-ops:site-bounds-ls-read", e, "debug");
    return null;
  }
}

function writeLocalStorageBounds(eventId: string, bounds: SiteMapBounds): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(lsKey(eventId), JSON.stringify(bounds));
  } catch (e) {
    logger.swallow("db-ops:site-bounds-ls-write", e, "debug");
  }
}

function clearLocalStorageBounds(eventId: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(lsKey(eventId));
  } catch (e) {
    logger.swallow("db-ops:site-bounds-ls-clear", e, "debug");
  }
}

/**
 * Read site-map bounds for an event.
 *
 * Returns the localStorage value first (fast path) AND kicks off a DB
 * fetch in the background — but only the localStorage value is returned
 * here for sync render. Use `getSiteMapBoundsByCompany` for the proper
 * batched DB-backed load.
 *
 * For one-off lookups this still works: if localStorage misses, we fall
 * back to a DB read.
 */
export async function getSiteMapBounds(eventId: string): Promise<SiteMapBounds | null> {
  const cached = readLocalStorageBounds(eventId);
  if (cached) return cached;

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("site_map_bounds")
      .select("west, south, east, north")
      .eq("event_id", eventId)
      .maybeSingle();
    if (error) {
      // Table may not exist yet (migration not applied). Fail soft.
      logger.swallow("db-ops:site-bounds-db-read", error, "debug");
      return null;
    }
    if (!data) return null;
    const bounds: SiteMapBounds = {
      west: data.west as number,
      south: data.south as number,
      east: data.east as number,
      north: data.north as number,
    };
    // Cache for next render
    writeLocalStorageBounds(eventId, bounds);
    return bounds;
  } catch (e) {
    logger.swallow("db-ops:site-bounds-db-read-throw", e, "debug");
    return null;
  }
}

/**
 * Load bounds for every event in a company in one query.
 * Used by the tactical map on mount so the overlay can drape immediately
 * for any operation that has saved bounds — no per-layer toggle needed.
 */
export async function getSiteMapBoundsByCompany(companyId: string): Promise<Record<string, SiteMapBounds>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("site_map_bounds")
      .select("event_id, west, south, east, north")
      .eq("company_id", companyId);
    if (error) {
      logger.swallow("db-ops:site-bounds-bulk-read", error, "debug");
      return {};
    }
    const out: Record<string, SiteMapBounds> = {};
    for (const row of (data ?? []) as Array<{ event_id: string; west: number; south: number; east: number; north: number }>) {
      out[row.event_id] = {
        west: row.west,
        south: row.south,
        east: row.east,
        north: row.north,
      };
      // Warm the localStorage cache
      writeLocalStorageBounds(row.event_id, out[row.event_id]);
    }
    return out;
  } catch (e) {
    logger.swallow("db-ops:site-bounds-bulk-read-throw", e, "debug");
    return {};
  }
}

/**
 * Persist site-map bounds for an event. Requires the caller to be a
 * manager of the owning company (enforced by RLS). Updates localStorage
 * cache on success.
 *
 * `companyId` is required so the DB row can be properly scoped. It is
 * not derived from the event because the events RLS would re-fetch and
 * we already have it on the client side.
 */
export async function saveSiteMapBounds(
  eventId: string,
  bounds: SiteMapBounds,
  companyId: string,
): Promise<void> {
  // localStorage write is best-effort; never block DB persistence on it.
  writeLocalStorageBounds(eventId, bounds);

  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("site_map_bounds")
      .upsert({
        event_id: eventId,
        company_id: companyId,
        west: bounds.west,
        south: bounds.south,
        east: bounds.east,
        north: bounds.north,
        updated_at: new Date().toISOString(),
      }, { onConflict: "event_id" });
    if (error) {
      logger.swallow("db-ops:site-bounds-db-write", error, "warn");
    }
  } catch (e) {
    logger.swallow("db-ops:site-bounds-db-write-throw", e, "warn");
  }
}

/**
 * Delete bounds for an event (e.g. after re-aligning is cancelled
 * mid-flight and the admin wants to start over).
 */
export async function clearSiteMapBounds(eventId: string): Promise<void> {
  clearLocalStorageBounds(eventId);
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("site_map_bounds")
      .delete()
      .eq("event_id", eventId);
    if (error) {
      logger.swallow("db-ops:site-bounds-db-clear", error, "debug");
    }
  } catch (e) {
    logger.swallow("db-ops:site-bounds-db-clear-throw", e, "debug");
  }
}

/**
 * One-time migration: scan every `site-map-bounds-*` localStorage key
 * and push to the DB. Idempotent — safe to call repeatedly. Returns the
 * number of bounds successfully migrated.
 *
 * Called once at startup of the tactical map so any admins who aligned
 * site maps before the table existed don't lose their work and don't
 * have to re-align.
 */
export async function migrateLegacyLocalStorageBounds(
  knownEvents: Array<{ id: string; companyId: string }>,
): Promise<number> {
  if (typeof localStorage === "undefined") return 0;
  let migrated = 0;
  for (const ev of knownEvents) {
    const local = readLocalStorageBounds(ev.id);
    if (!local) continue;
    try {
      const supabase = createClient();
      // Only insert if not already in the DB — preserves any newer bounds
      // saved from another device.
      const { data: existing } = await supabase
        .from("site_map_bounds")
        .select("event_id")
        .eq("event_id", ev.id)
        .maybeSingle();
      if (existing) continue;
      const { error } = await supabase.from("site_map_bounds").insert({
        event_id: ev.id,
        company_id: ev.companyId,
        west: local.west,
        south: local.south,
        east: local.east,
        north: local.north,
      });
      if (!error) migrated++;
      // If error, the row may already exist or RLS may have rejected
      // (caller is not a manager). Either way, we keep going.
    } catch (e) {
      logger.swallow("db-ops:site-bounds-migrate", e, "debug");
    }
  }
  return migrated;
}
