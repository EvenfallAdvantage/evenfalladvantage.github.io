import { createClient } from "./client";
import { ts, ensureInternalUser } from "./db-helpers";

// ─── Events (Operations) ──────────────────────────────

export async function getEvents(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("events")
    .select("*, clients(name)")
    .eq("company_id", companyId)
    .order("start_date", { ascending: true });
  return data ?? [];
}

export async function createEvent(params: {
  companyId: string;
  name: string;
  description?: string;
  location?: string;
  startDate: string;
  endDate: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  opsGuide?: Record<string, any>;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      id: crypto.randomUUID(),
      company_id: params.companyId,
      name: params.name,
      description: params.description ?? null,
      location: params.location ?? null,
      start_date: params.startDate,
      end_date: params.endDate,
      ops_guide: params.opsGuide ?? null,
      status: "draft",
      ...ts(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateEvent(eventId: string, updates: {
  name?: string;
  description?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  opsGuide?: Record<string, any>;
}) {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: Record<string, any> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.description !== undefined) row.description = updates.description;
  if (updates.location !== undefined) row.location = updates.location;
  if (updates.startDate !== undefined) row.start_date = updates.startDate;
  if (updates.endDate !== undefined) row.end_date = updates.endDate;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.opsGuide !== undefined) row.ops_guide = updates.opsGuide;
  const { data, error } = await supabase
    .from("events")
    .update(row)
    .eq("id", eventId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateEventStatus(eventId: string, status: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("events")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", eventId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteEvent(eventId: string) {
  const supabase = createClient();
  // Shifts cascade-delete via FK
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) throw error;
}

// ─── Schedule (Shifts + Events for user) ─────────────

export async function getUserShifts(companyId: string) {
  const userId = await ensureInternalUser();
  if (!userId) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("shifts")
    .select("*, events!inner(id, name, location, company_id, ops_guide)")
    .eq("assigned_user_id", userId)
    .eq("events.company_id", companyId)
    .order("start_time", { ascending: true });
  return data ?? [];
}

export async function getUpcomingEvents(companyId: string) {
  const supabase = createClient();
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("company_id", companyId)
    .gte("end_date", now)
    .order("start_date", { ascending: true })
    .limit(20);
  return data ?? [];
}

// ─── Shift CRUD + assignment (admin) ─────────────────

export async function getEventShifts(eventId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("shifts")
    .select("*, users(first_name, last_name)")
    .eq("event_id", eventId)
    .order("start_time", { ascending: true });
  return data ?? [];
}

export async function createShift(params: {
  eventId: string;
  role?: string;
  startTime: string;
  endTime: string;
  assignedUserId?: string;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shifts")
    .insert({
      id: crypto.randomUUID(),
      event_id: params.eventId,
      role: params.role ?? null,
      start_time: params.startTime,
      end_time: params.endTime,
      assigned_user_id: params.assignedUserId ?? null,
      status: params.assignedUserId ? "confirmed" : "open",
      ...ts(),
    })
    .select("*, users(first_name, last_name)")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function assignShift(shiftId: string, userId: string | null) {
  const supabase = createClient();
  const { error } = await supabase
    .from("shifts")
    .update({ assigned_user_id: userId, status: userId ? "confirmed" : "open" })
    .eq("id", shiftId);
  if (error) throw error;
}

export async function deleteShift(shiftId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("shifts").delete().eq("id", shiftId);
  if (error) throw error;
}

// ─── Assets (Armory) ──────────────────────────────────

export async function getAssets(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("assets")
    .select("*, users(first_name, last_name)")
    .eq("company_id", companyId)
    .order("name", { ascending: true });
  return data ?? [];
}

export async function createAsset(params: {
  companyId: string;
  name: string;
  assetType?: string;
  serialNumber?: string;
}) {
  const supabase = createClient();
  const qrCode = `ASSET-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const { data, error } = await supabase
    .from("assets")
    .insert({
      id: crypto.randomUUID(),
      company_id: params.companyId,
      name: params.name,
      asset_type: params.assetType ?? null,
      serial_number: params.serialNumber ?? null,
      qr_code: qrCode,
      ...ts(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function checkoutAsset(assetId: string) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("assets")
    .update({ status: "checked_out", current_holder_id: userId, updated_at: new Date().toISOString() })
    .eq("id", assetId)
    .select("*, users(first_name, last_name)")
    .maybeSingle();
  if (error) throw error;
  // Log the checkout
  await supabase.from("asset_logs").insert({
    id: crypto.randomUUID(),
    asset_id: assetId,
    user_id: userId,
    action: "checkout",
    created_at: new Date().toISOString(),
  }).then(() => {});
  return data;
}

export async function checkinAsset(assetId: string) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("assets")
    .update({ status: "available", current_holder_id: null, updated_at: new Date().toISOString() })
    .eq("id", assetId)
    .select()
    .maybeSingle();
  if (error) throw error;
  // Log the checkin
  await supabase.from("asset_logs").insert({
    id: crypto.randomUUID(),
    asset_id: assetId,
    user_id: userId,
    action: "checkin",
    created_at: new Date().toISOString(),
  }).then(() => {});
  return data;
}

export async function getAssetByQrCode(companyId: string, qrCode: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("assets")
    .select("*, users(first_name, last_name)")
    .eq("company_id", companyId)
    .eq("qr_code", qrCode)
    .maybeSingle();
  return data;
}

export async function deleteAsset(assetId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("assets").delete().eq("id", assetId);
  if (error) throw error;
}

// ─── Incidents ───────────────────────────────────────

export async function getIncidents(companyId: string, status?: string) {
  const supabase = createClient();
  let q = supabase
    .from("incidents")
    .select("*, reported_user:users!incidents_reported_by_fkey(first_name, last_name), assigned_user:users!incidents_assigned_to_fkey(first_name, last_name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (status && status !== "all") q = q.eq("status", status);
  const { data } = await q;
  return data ?? [];
}

export async function getIncident(incidentId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("incidents")
    .select("*, reported_user:users!incidents_reported_by_fkey(first_name, last_name), assigned_user:users!incidents_assigned_to_fkey(first_name, last_name)")
    .eq("id", incidentId)
    .maybeSingle();
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
  const { data } = await supabase
    .from("incident_updates")
    .select("*, users(first_name, last_name)")
    .eq("incident_id", incidentId)
    .order("created_at", { ascending: true });
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
  const { error } = await supabase.from("incidents").delete().eq("id", incidentId);
  if (error) throw error;
}

// ─── Checkpoints & Patrol ────────────────────────────

export async function getCheckpoints(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("checkpoints")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return data ?? [];
}

export async function createCheckpoint(companyId: string, params: {
  name: string; description?: string; location?: string; eventId?: string;
}) {
  const supabase = createClient();
  const { data, error } = await supabase.from("checkpoints").insert({
    id: crypto.randomUUID(),
    company_id: companyId,
    name: params.name,
    description: params.description ?? null,
    location: params.location ?? null,
    event_id: params.eventId ?? null,
    qr_code: `CP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    is_active: true,
    created_at: new Date().toISOString(),
  }).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteCheckpoint(checkpointId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("checkpoints").delete().eq("id", checkpointId);
  if (error) throw error;
}

export async function getPatrolRoutes(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("patrol_routes")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name");
  return data ?? [];
}

export async function createPatrolRoute(companyId: string, params: {
  name: string; description?: string; checkpointIds: string[]; frequencyMin?: number;
}) {
  const supabase = createClient();
  const { data, error } = await supabase.from("patrol_routes").insert({
    id: crypto.randomUUID(),
    company_id: companyId,
    name: params.name,
    description: params.description ?? null,
    checkpoint_ids: params.checkpointIds,
    frequency_min: params.frequencyMin ?? 60,
    is_active: true,
    ...ts(),
  }).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function deletePatrolRoute(routeId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("patrol_routes").delete().eq("id", routeId);
  if (error) throw error;
}

export async function logPatrolScan(companyId: string, checkpointId: string, params?: {
  routeId?: string; notes?: string; status?: string;
}) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase.from("patrol_logs").insert({
    id: crypto.randomUUID(),
    company_id: companyId,
    checkpoint_id: checkpointId,
    user_id: userId,
    route_id: params?.routeId ?? null,
    notes: params?.notes ?? null,
    status: params?.status ?? "ok",
    scanned_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  }).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPatrolLogs(companyId: string, limit = 50) {
  const supabase = createClient();
  const { data } = await supabase
    .from("patrol_logs")
    .select("*, checkpoints(name, location), users(first_name, last_name)")
    .eq("company_id", companyId)
    .order("scanned_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
