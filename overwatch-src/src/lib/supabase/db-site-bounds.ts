import { createClient } from "./client";
import { logger } from "@/lib/logger";

// ─── Site Map Alignment Bounds ────────────────────────
// Stored in the events table's settings JSON column as settings.site_map_bounds

export interface SiteMapBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export async function getSiteMapBounds(eventId: string): Promise<SiteMapBounds | null> {
  // Try localStorage first (instant, no network)
  try {
    const key = `site-map-bounds-${eventId}`;
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
  } catch (e) { logger.swallow("db-ops:site-bounds-ls-read", e, "debug"); }

  // Fallback to DB (the 'settings' JSONB column may not exist yet — handle gracefully)
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("events")
      .select("settings")
      .eq("id", eventId)
      .maybeSingle();
    if (!error && data) {
      const dbBounds = (data.settings as Record<string, unknown>)?.site_map_bounds as SiteMapBounds | undefined;
      if (dbBounds) return dbBounds;
    }
  } catch (e) { logger.swallow("db-ops:site-bounds-db-read", e, "debug"); }

  return null;
}

export async function saveSiteMapBounds(eventId: string, bounds: SiteMapBounds): Promise<void> {
  // Always save to localStorage (instant, reliable)
  try {
    localStorage.setItem(`site-map-bounds-${eventId}`, JSON.stringify(bounds));
  } catch (e) { logger.swallow("db-ops:site-bounds-ls-write", e, "debug"); }

  // Also try to save to DB (company-wide persistence)
  // The 'settings' JSONB column may not exist yet — fail silently
  try {
    const supabase = createClient();
    const { data: existing, error: readErr } = await supabase
      .from("events")
      .select("settings")
      .eq("id", eventId)
      .maybeSingle();

    if (readErr) return; // Column likely doesn't exist — skip DB save

    const settings = { ...(existing?.settings as Record<string, unknown> ?? {}), site_map_bounds: bounds };
    await supabase.from("events").update({ settings }).eq("id", eventId);
  } catch (e) { logger.swallow("db-ops:site-bounds-db-write", e, "warn"); }
}

export async function clearSiteMapBounds(eventId: string): Promise<void> {
  try { localStorage.removeItem(`site-map-bounds-${eventId}`); } catch (e) { logger.swallow("db-ops:site-bounds-ls-clear", e, "debug"); }

  try {
    const supabase = createClient();
    const { data: existing, error: readErr } = await supabase
      .from("events")
      .select("settings")
      .eq("id", eventId)
      .maybeSingle();

    if (readErr) return; // Column likely doesn't exist

    const settings = { ...(existing?.settings as Record<string, unknown> ?? {}) };
    delete settings.site_map_bounds;
    await supabase.from("events").update({ settings }).eq("id", eventId);
  } catch (e) { logger.swallow("db-ops:site-bounds-db-clear", e, "warn"); }
}
