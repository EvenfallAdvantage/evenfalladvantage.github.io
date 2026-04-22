import { createClient } from "./client";
import { ts, ensureInternalUser } from "./db-helpers";
import { logDbReadError } from "./db-error";

// ─── Incidents ───────────────────────────────────────

export async function getIncidents(companyId: string, status?: string) {
  const supabase = createClient();
  let q = supabase
    .from("incidents")
    .select("*, reported_user:users!incidents_reported_by_fkey(first_name, last_name), assigned_user:users!incidents_assigned_to_fkey(first_name, last_name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (status && status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) { logDbReadError("incidents", error); return []; }
  return data ?? [];
}

export async function getIncident(incidentId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("incidents")
    .select("*, reported_user:users!incidents_reported_by_fkey(first_name, last_name), assigned_user:users!incidents_assigned_to_fkey(first_name, last_name)")
    .eq("id", incidentId)
    .maybeSingle();
  if (error) { logDbReadError("incident details", error); return null; }
  return data;
}

export async function createIncident(companyId: string, params: {
  title: string; description?: string; type?: string;
  severity?: string; priority?: string; location?: string; eventId?: string;
}) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase.from("incidents").insert({
    id: crypto.randomUUID(),
    company_id: companyId,
    reported_by: userId,
    title: params.title,
    description: params.description ?? null,
    type: params.type ?? "general",
    severity: params.severity ?? "low",
    priority: params.priority ?? "medium",
    status: "open",
    location: params.location ?? null,
    event_id: params.eventId ?? null,
    ...ts(),
  }).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateIncident(incidentId: string, updates: Record<string, unknown>) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("incidents")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", incidentId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getIncidentUpdates(incidentId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("incident_updates")
    .select("*, users(first_name, last_name)")
    .eq("incident_id", incidentId)
    .order("created_at", { ascending: true });
  if (error) { logDbReadError("incident updates", error); return []; }
  return data ?? [];
}

export async function addIncidentUpdate(incidentId: string, content: string, type = "note") {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase.from("incident_updates").insert({
    id: crypto.randomUUID(),
    incident_id: incidentId,
    user_id: userId,
    content,
    type,
    created_at: new Date().toISOString(),
  }).select("*, users(first_name, last_name)").maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteIncident(incidentId: string) {
  const supabase = createClient();

  // First, check if the incident has a storyboard pin and remove it
  const { data: incident } = await supabase
    .from("incidents")
    .select("storyboard_id, storyboard_pin_id")
    .eq("id", incidentId)
    .maybeSingle();

  if (incident?.storyboard_id && incident?.storyboard_pin_id) {
    // Load the storyboard, remove the pin, and save
    const { data: storyboard } = await supabase
      .from("storyboards")
      .select("id, pins")
      .eq("id", incident.storyboard_id)
      .maybeSingle();

    if (storyboard?.pins && Array.isArray(storyboard.pins)) {
      const updatedPins = (storyboard.pins as Array<{ id: string }>).filter(
        (p) => p.id !== incident.storyboard_pin_id
      );
      await supabase
        .from("storyboards")
        .update({ pins: updatedPins, updated_at: new Date().toISOString() })
        .eq("id", storyboard.id);
    }
  }

  // Then delete the incident
  const { error } = await supabase.from("incidents").delete().eq("id", incidentId);
  if (error) throw error;
}
