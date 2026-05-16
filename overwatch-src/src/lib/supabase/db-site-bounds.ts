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

/** A single (lat, lng) pair. */
export interface GeoPoint { lat: number; lng: number }

/**
 * Four corners of the source image (in image pixel coordinates,
 * normalized 0..1) mapped to lat/lng. Naming uses image-space because
 * the image may be rotated relative to compass-north:
 *
 *   c00 = image (0, 0) — top-left of the source image
 *   c10 = image (1, 0) — top-right
 *   c11 = image (1, 1) — bottom-right
 *   c01 = image (0, 1) — bottom-left
 *
 * For a north-up image, c00 corresponds to NW, c10 to NE, etc.; for a
 * west-up image, c00 corresponds to SW, c10 to NW, etc.
 */
export interface SiteMapQuad {
  c00: GeoPoint;
  c10: GeoPoint;
  c11: GeoPoint;
  c01: GeoPoint;
}

export interface SiteMapBounds {
  // Axis-aligned bounding box of the quad. Kept on every row so legacy
  // callers (heatmap rectangle backdrop, fly-to-bounds camera) work
  // without quad math. For new quad-aware rows this is computed from
  // the four corners.
  west: number;
  south: number;
  east: number;
  north: number;
  /**
   * Full quadrilateral. Set on rows aligned after the May 2026 quad
   * upgrade. When present, callers should prefer the quad for accurate
   * positioning of pins, heatmap samples, etc. When absent, the row is
   * legacy axis-aligned — fall back to the w/s/e/n rectangle.
   */
  quad?: SiteMapQuad;
}

/**
 * Map a point in source-image space (x, y in 0..1, origin at top-left)
 * to a geographic position, using the quad if present and the axis-
 * aligned bounding box otherwise.
 *
 * The quad path uses bilinear interpolation:
 *   top    = lerp(c00, c10, x)
 *   bottom = lerp(c01, c11, x)
 *   result = lerp(top,  bottom, y)
 *
 * This is exact for affine source images (the case our 3-point aligner
 * produces) and a reasonable approximation for the quasi-perspective
 * case of a tilted/photographed plan.
 */
export function imageToGeo(bounds: SiteMapBounds, imageX: number, imageY: number): GeoPoint {
  const q = bounds.quad;
  if (q) {
    const topLat = q.c00.lat + (q.c10.lat - q.c00.lat) * imageX;
    const topLng = q.c00.lng + (q.c10.lng - q.c00.lng) * imageX;
    const botLat = q.c01.lat + (q.c11.lat - q.c01.lat) * imageX;
    const botLng = q.c01.lng + (q.c11.lng - q.c01.lng) * imageX;
    return {
      lat: topLat + (botLat - topLat) * imageY,
      lng: topLng + (botLng - topLng) * imageY,
    };
  }
  // Legacy axis-aligned path. Image (0,0) = top-left = (north, west).
  const lngSpan = bounds.east - bounds.west;
  const latSpan = bounds.north - bounds.south;
  return {
    lat: bounds.north - imageY * latSpan,
    lng: bounds.west + imageX * lngSpan,
  };
}

/**
 * Derive the axis-aligned bounding box that contains the four quad
 * corners. Used when saving a new quad so the legacy w/s/e/n columns
 * stay consistent with the quad geometry.
 */
export function bboxOfQuad(q: SiteMapQuad): { west: number; south: number; east: number; north: number } {
  const lats = [q.c00.lat, q.c10.lat, q.c11.lat, q.c01.lat];
  const lngs = [q.c00.lng, q.c10.lng, q.c11.lng, q.c01.lng];
  return {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    west: Math.min(...lngs),
  };
}

function lsKey(eventId: string): string {
  return `site-map-bounds-${eventId}`;
}

function isGeoPoint(p: unknown): p is GeoPoint {
  return !!p && typeof p === "object"
    && typeof (p as GeoPoint).lat === "number"
    && typeof (p as GeoPoint).lng === "number";
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
    // If a quad is present, all four corners must be valid GeoPoints —
    // otherwise drop the quad (don't reject the whole bounds: bbox is
    // still usable for axis-aligned fallback render).
    if (b.quad) {
      if (!isGeoPoint(b.quad.c00) || !isGeoPoint(b.quad.c10)
       || !isGeoPoint(b.quad.c11) || !isGeoPoint(b.quad.c01)) {
        delete b.quad;
      }
    }
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
type SiteMapBoundsRow = {
  west: number; south: number; east: number; north: number;
  c00_lat: number | null; c00_lng: number | null;
  c10_lat: number | null; c10_lng: number | null;
  c11_lat: number | null; c11_lng: number | null;
  c01_lat: number | null; c01_lng: number | null;
};

const SITE_MAP_BOUNDS_COLUMNS =
  "west, south, east, north, c00_lat, c00_lng, c10_lat, c10_lng, c11_lat, c11_lng, c01_lat, c01_lng";

/** Convert a DB row to the in-memory shape, attaching `quad` iff all 8 corners are set. */
function rowToBounds(row: SiteMapBoundsRow): SiteMapBounds {
  const bounds: SiteMapBounds = {
    west: row.west, south: row.south, east: row.east, north: row.north,
  };
  if (row.c00_lat != null && row.c00_lng != null
      && row.c10_lat != null && row.c10_lng != null
      && row.c11_lat != null && row.c11_lng != null
      && row.c01_lat != null && row.c01_lng != null) {
    bounds.quad = {
      c00: { lat: row.c00_lat, lng: row.c00_lng },
      c10: { lat: row.c10_lat, lng: row.c10_lng },
      c11: { lat: row.c11_lat, lng: row.c11_lng },
      c01: { lat: row.c01_lat, lng: row.c01_lng },
    };
  }
  return bounds;
}

/** If the DB select fails because the quad columns don't exist yet, fall back to axis-aligned columns. */
function isMissingQuadColumnsError(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  const msg = error.message?.toLowerCase() ?? "";
  return msg.includes("c00_lat") || msg.includes("c00_lng") || msg.includes("does not exist");
}

export async function getSiteMapBounds(eventId: string): Promise<SiteMapBounds | null> {
  const cached = readLocalStorageBounds(eventId);
  if (cached) return cached;

  try {
    const supabase = createClient();
    let { data, error } = await supabase
      .from("site_map_bounds")
      .select(SITE_MAP_BOUNDS_COLUMNS)
      .eq("event_id", eventId)
      .maybeSingle();
    // Pre-migration fallback: the quad columns don't exist yet.
    if (error && isMissingQuadColumnsError(error)) {
      ({ data, error } = await supabase
        .from("site_map_bounds")
        .select("west, south, east, north")
        .eq("event_id", eventId)
        .maybeSingle());
    }
    if (error) {
      // Table may not exist yet (migration not applied). Fail soft.
      logger.swallow("db-ops:site-bounds-db-read", error, "debug");
      return null;
    }
    if (!data) return null;
    const bounds = rowToBounds(data as SiteMapBoundsRow);
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
    let { data, error } = await supabase
      .from("site_map_bounds")
      .select(`event_id, ${SITE_MAP_BOUNDS_COLUMNS}`)
      .eq("company_id", companyId);
    if (error && isMissingQuadColumnsError(error)) {
      ({ data, error } = await supabase
        .from("site_map_bounds")
        .select("event_id, west, south, east, north")
        .eq("company_id", companyId));
    }
    if (error) {
      logger.swallow("db-ops:site-bounds-bulk-read", error, "debug");
      return {};
    }
    const out: Record<string, SiteMapBounds> = {};
    for (const row of (data ?? []) as Array<SiteMapBoundsRow & { event_id: string }>) {
      out[row.event_id] = rowToBounds(row);
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
  // Compute the bbox from the quad if present, otherwise trust the caller's
  // w/s/e/n values. Keeps the legacy columns consistent with the quad.
  const bbox = bounds.quad ? bboxOfQuad(bounds.quad) : {
    west: bounds.west, south: bounds.south, east: bounds.east, north: bounds.north,
  };
  // Normalize the in-memory shape we'll cache: ensure w/s/e/n match the
  // bbox derived from the quad, so callers downstream see consistent data.
  const normalized: SiteMapBounds = { ...bbox, quad: bounds.quad };

  // localStorage write is best-effort; never block DB persistence on it.
  writeLocalStorageBounds(eventId, normalized);

  try {
    const supabase = createClient();
    const row: Record<string, unknown> = {
      event_id: eventId,
      company_id: companyId,
      west: bbox.west,
      south: bbox.south,
      east: bbox.east,
      north: bbox.north,
      updated_at: new Date().toISOString(),
    };
    if (bounds.quad) {
      row.c00_lat = bounds.quad.c00.lat; row.c00_lng = bounds.quad.c00.lng;
      row.c10_lat = bounds.quad.c10.lat; row.c10_lng = bounds.quad.c10.lng;
      row.c11_lat = bounds.quad.c11.lat; row.c11_lng = bounds.quad.c11.lng;
      row.c01_lat = bounds.quad.c01.lat; row.c01_lng = bounds.quad.c01.lng;
    } else {
      // Explicit nulls so an upsert from a quad row → axis-aligned row
      // clears the stale corners.
      row.c00_lat = null; row.c00_lng = null;
      row.c10_lat = null; row.c10_lng = null;
      row.c11_lat = null; row.c11_lng = null;
      row.c01_lat = null; row.c01_lng = null;
    }

    let { error } = await supabase
      .from("site_map_bounds")
      .upsert(row, { onConflict: "event_id" });

    // Pre-migration fallback: quad columns don't exist yet.
    if (error && isMissingQuadColumnsError(error)) {
      const fallback: Record<string, unknown> = {
        event_id: eventId,
        company_id: companyId,
        west: bbox.west, south: bbox.south, east: bbox.east, north: bbox.north,
        updated_at: new Date().toISOString(),
      };
      ({ error } = await supabase
        .from("site_map_bounds")
        .upsert(fallback, { onConflict: "event_id" }));
    }

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
