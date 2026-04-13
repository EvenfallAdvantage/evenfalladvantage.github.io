/**
 * Map Annotations — tactical drawings on the 3D globe.
 * Stored per company, optionally scoped to an operation.
 * Real-time synced via Supabase Realtime.
 */

import { createClient } from "./client";
import { logDbReadError } from "./db-error";

export interface MapAnnotation {
  id: string;
  companyId: string;
  eventId: string | null;
  type: "line" | "polygon" | "circle" | "arrow" | "text" | "freehand";
  geometry: { positions: [number, number][]; radius?: number }; // [lng, lat] pairs
  label: string | null;
  color: string;
  style: "solid" | "dashed" | "dotted";
  createdBy: string | null;
  createdAt: string;
}

export async function getAnnotations(companyId: string, eventId?: string): Promise<MapAnnotation[]> {
  const supabase = createClient();
  let query = supabase
    .from("map_annotations")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (eventId) {
    query = query.or(`event_id.eq.${eventId},event_id.is.null`);
  }

  const { data, error } = await query;
  if (error) { logDbReadError("map annotations", error); return []; }

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    companyId: r.company_id as string,
    eventId: r.event_id as string | null,
    type: r.type as MapAnnotation["type"],
    geometry: r.geometry as MapAnnotation["geometry"],
    label: r.label as string | null,
    color: (r.color as string) || "#ef4444",
    style: (r.style as MapAnnotation["style"]) || "solid",
    createdBy: r.created_by as string | null,
    createdAt: r.created_at as string,
  }));
}

export async function createAnnotation(
  companyId: string,
  annotation: Omit<MapAnnotation, "id" | "companyId" | "createdAt" | "createdBy">,
  userId?: string,
): Promise<MapAnnotation | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("map_annotations")
    .insert({
      company_id: companyId,
      event_id: annotation.eventId,
      type: annotation.type,
      geometry: annotation.geometry,
      label: annotation.label,
      color: annotation.color,
      style: annotation.style,
      created_by: userId ?? null,
    })
    .select()
    .single();

  if (error) { console.error("[Annotations] Create failed:", error); return null; }

  return {
    id: data.id,
    companyId: data.company_id,
    eventId: data.event_id,
    type: data.type,
    geometry: data.geometry,
    label: data.label,
    color: data.color || "#ef4444",
    style: data.style || "solid",
    createdBy: data.created_by,
    createdAt: data.created_at,
  };
}

export async function deleteAnnotation(annotationId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("map_annotations").delete().eq("id", annotationId);
  if (error) console.error("[Annotations] Delete failed:", error);
}

export function subscribeAnnotations(companyId: string, onChange: () => void): () => void {
  const supabase = createClient();
  const channel = supabase
    .channel(`annotations-${companyId}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "map_annotations",
      filter: `company_id=eq.${companyId}`,
    }, () => onChange())
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
