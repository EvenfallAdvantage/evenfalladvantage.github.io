/**
 * Geofences (Phase 7 / HaloLocate)
 *
 * Venue boundaries stored as GeoJSON Polygon (lng/lat per RFC 7946).
 * Plotted by `use-geofences-layer.ts` on the Cesium tactical map.
 * Members read; admins manage.
 */

import { createClient } from "./client";
import { ts, ensureInternalUser } from "./db-helpers";
import { logDbReadError } from "./db-error";

// ─── Types ─────────────────────────────────────────────────

/**
 * GeoJSON Polygon as JSONB. Outer ring then any holes; each ring is a closed
 * list of [lng, lat] pairs whose first and last entries are equal. We allow
 * MultiPolygon at the type level for forward compatibility but the draw UI
 * only emits plain Polygon for now.
 */
export type GeofenceGeometry =
  | { type: "Polygon"; coordinates: Array<Array<[number, number]>> }
  | { type: "MultiPolygon"; coordinates: Array<Array<Array<[number, number]>>> };

export interface Geofence {
  id: string;
  companyId: string;
  teamId: string | null;
  name: string;
  description: string | null;
  geometry: GeofenceGeometry;
  color: string;
  fillOpacity: number;
  strokeWidth: number;
  isActive: boolean;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Mapping ───────────────────────────────────────────────

interface GeofenceRow {
  id: string;
  company_id: string;
  team_id: string | null;
  name: string;
  description: string | null;
  geometry: GeofenceGeometry;
  color: string;
  fill_opacity: number | string;
  stroke_width: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(r: GeofenceRow): Geofence {
  return {
    id: r.id,
    companyId: r.company_id,
    teamId: r.team_id,
    name: r.name,
    description: r.description,
    geometry: r.geometry,
    color: r.color,
    // Postgres NUMERIC arrives as a string in the JS client; coerce here.
    fillOpacity: typeof r.fill_opacity === "string" ? parseFloat(r.fill_opacity) : r.fill_opacity,
    strokeWidth: r.stroke_width,
    isActive: r.is_active,
    createdById: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ─── Geometry validation ───────────────────────────────────

/**
 * Sanity-check a candidate GeofenceGeometry before persisting. Throws on
 * structural problems. We do NOT enforce ring closure here - we close
 * unclosed rings to match Cesium expectations.
 */
export function validateAndCloseGeometry(g: unknown): GeofenceGeometry {
  if (!g || typeof g !== "object") {
    throw new Error("Geometry must be an object");
  }
  const obj = g as { type?: unknown; coordinates?: unknown };
  if (obj.type !== "Polygon" && obj.type !== "MultiPolygon") {
    throw new Error("Geometry type must be Polygon or MultiPolygon");
  }
  if (!Array.isArray(obj.coordinates)) {
    throw new Error("Geometry coordinates must be an array");
  }

  const closeRing = (ring: Array<[number, number]>): Array<[number, number]> => {
    if (ring.length < 3) {
      throw new Error("Polygon ring must have at least 3 points");
    }
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      return [...ring, [first[0], first[1]]];
    }
    return ring;
  };

  if (obj.type === "Polygon") {
    const rings = obj.coordinates as unknown[];
    const validRings = rings.map((r, ringIdx) => {
      if (!Array.isArray(r)) throw new Error(`Ring ${ringIdx} must be an array`);
      const ring = r as Array<unknown>;
      const points = ring.map((p, pIdx) => {
        if (!Array.isArray(p) || p.length < 2) {
          throw new Error(`Point ${ringIdx}/${pIdx} must be [lng, lat]`);
        }
        const lng = Number(p[0]);
        const lat = Number(p[1]);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
          throw new Error(`Point ${ringIdx}/${pIdx} has non-numeric coordinates`);
        }
        if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
          throw new Error(`Point ${ringIdx}/${pIdx} lng/lat out of range`);
        }
        return [lng, lat] as [number, number];
      });
      return closeRing(points);
    });
    return { type: "Polygon", coordinates: validRings };
  }

  // MultiPolygon: array of polygons (each polygon is an array of rings).
  const polys = obj.coordinates as unknown[];
  const validPolys = polys.map((poly, polyIdx) => {
    if (!Array.isArray(poly)) throw new Error(`Polygon ${polyIdx} must be an array`);
    return (poly as unknown[]).map((r, ringIdx) => {
      if (!Array.isArray(r)) throw new Error(`Ring ${polyIdx}/${ringIdx} must be an array`);
      const ring = r as Array<unknown>;
      const points = ring.map((p, pIdx) => {
        if (!Array.isArray(p) || p.length < 2) {
          throw new Error(`Point ${polyIdx}/${ringIdx}/${pIdx} must be [lng, lat]`);
        }
        const lng = Number(p[0]);
        const lat = Number(p[1]);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
          throw new Error(`Point ${polyIdx}/${ringIdx}/${pIdx} non-numeric`);
        }
        return [lng, lat] as [number, number];
      });
      return closeRing(points);
    });
  });
  return { type: "MultiPolygon", coordinates: validPolys };
}

// ─── CRUD ──────────────────────────────────────────────────

export async function getGeofences(
  companyId: string,
  filters?: { teamId?: string; activeOnly?: boolean },
): Promise<Geofence[]> {
  const supabase = createClient();
  let q = supabase
    .from("geofences")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (filters?.activeOnly) q = q.eq("is_active", true);
  if (filters?.teamId) q = q.eq("team_id", filters.teamId);
  const { data, error } = await q;
  if (error) {
    logDbReadError("geofences", error);
    return [];
  }
  return (data ?? []).map((r: unknown) => mapRow(r as GeofenceRow));
}

export async function getGeofence(id: string): Promise<Geofence | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("geofences")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    logDbReadError("geofence", error);
    return null;
  }
  return data ? mapRow(data as GeofenceRow) : null;
}

export async function createGeofence(
  companyId: string,
  params: {
    name: string;
    geometry: GeofenceGeometry;
    description?: string;
    teamId?: string | null;
    color?: string;
    fillOpacity?: number;
    strokeWidth?: number;
    isActive?: boolean;
  },
): Promise<Geofence | null> {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const geometry = validateAndCloseGeometry(params.geometry);
  const { data, error } = await supabase
    .from("geofences")
    .insert({
      id: crypto.randomUUID(),
      company_id: companyId,
      team_id: params.teamId ?? null,
      name: params.name,
      description: params.description ?? null,
      geometry,
      color: params.color ?? "#6366f1",
      fill_opacity: params.fillOpacity ?? 0.2,
      stroke_width: params.strokeWidth ?? 2,
      is_active: params.isActive ?? true,
      created_by: userId,
      ...ts(),
    })
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as GeofenceRow) : null;
}

export async function updateGeofence(
  id: string,
  updates: Partial<{
    name: string;
    description: string | null;
    teamId: string | null;
    geometry: GeofenceGeometry;
    color: string;
    fillOpacity: number;
    strokeWidth: number;
    isActive: boolean;
  }>,
): Promise<Geofence | null> {
  const supabase = createClient();
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.teamId !== undefined) payload.team_id = updates.teamId;
  if (updates.geometry !== undefined) payload.geometry = validateAndCloseGeometry(updates.geometry);
  if (updates.color !== undefined) payload.color = updates.color;
  if (updates.fillOpacity !== undefined) payload.fill_opacity = updates.fillOpacity;
  if (updates.strokeWidth !== undefined) payload.stroke_width = updates.strokeWidth;
  if (updates.isActive !== undefined) payload.is_active = updates.isActive;

  const { data, error } = await supabase
    .from("geofences")
    .update(payload)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as GeofenceRow) : null;
}

export async function deleteGeofence(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("geofences").delete().eq("id", id);
  return !error;
}
