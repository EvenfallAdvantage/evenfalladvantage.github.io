import { createClient } from "./client";
import { ts } from "./db-helpers";
import { logDbReadError } from "./db-error";

// ─── Events (Operations) ──────────────────────────────

export async function getEvents(companyId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("events")
    .select("*, clients(name)")
    .eq("company_id", companyId)
    .order("start_date", { ascending: true });
  if (error) { logDbReadError("events", error); return []; }
  return data ?? [];
}

export async function createEvent(params: {
  id?: string;
  companyId: string;
  name: string;
  description?: string;
  location?: string;
  startDate: string;
  endDate: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  opsGuide?: Record<string, any>;
  engagementType?: string;
  venueType?: string;
  estimatedAttendance?: string;
  riskLevel?: string;
  tlpStep?: string;
  siteMapUrl?: string;
  locationLat?: number;
  locationLng?: number;
  timezone?: string;
  postOrders?: string;
  certificationRequirements?: string[];
}) {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: Record<string, any> = {
    id: params.id ?? crypto.randomUUID(),
    company_id: params.companyId,
    name: params.name,
    description: params.description ?? null,
    location: params.location ?? null,
    location_lat: params.locationLat ?? null,
    location_lng: params.locationLng ?? null,
    start_date: params.startDate,
    end_date: params.endDate,
    ops_guide: params.opsGuide ?? null,
    status: "draft",
    engagement_type: params.engagementType ?? null,
    venue_type: params.venueType ?? null,
    estimated_attendance: params.estimatedAttendance ?? null,
    risk_level: params.riskLevel ?? null,
    tlp_step: params.tlpStep ?? "receive_mission",
    site_map_url: params.siteMapUrl ?? null,
    timezone: params.timezone ?? null,
    post_orders: params.postOrders ?? null,
    certification_requirements: params.certificationRequirements ?? [],
    ...ts(),
  };
  const { data, error } = await supabase
    .from("events")
    .insert(row)
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
  timezone?: string;
  postOrders?: string;
  certificationRequirements?: string[];
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
  if (updates.timezone !== undefined) row.timezone = updates.timezone;
  if (updates.postOrders !== undefined) row.post_orders = updates.postOrders;
  if (updates.certificationRequirements !== undefined) row.certification_requirements = updates.certificationRequirements;
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

export async function getUpcomingEvents(companyId: string) {
  const supabase = createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("company_id", companyId)
    .gte("end_date", now)
    .order("start_date", { ascending: true })
    .limit(20);
  if (error) { logDbReadError("upcoming events", error); return []; }
  return data ?? [];
}

// ─── Post Orders ─────────────────────────────────────

export async function getEventPostOrders(eventId: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("events")
    .select("post_orders")
    .eq("id", eventId)
    .maybeSingle();
  if (error) { logDbReadError("event post_orders", error); return null; }
  return data?.post_orders ?? null;
}

export async function updateEventPostOrders(eventId: string, text: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("events")
    .update({ post_orders: text, updated_at: new Date().toISOString() })
    .eq("id", eventId);
  if (error) throw error;
}

export async function getEventSiteMapUrl(eventId: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("events")
    .select("site_map_url")
    .eq("id", eventId)
    .maybeSingle();
  if (error) { logDbReadError("site map URL", error); return null; }
  return data?.site_map_url ?? null;
}

// ─── Operation Activity Feed ─────────────────────────

export type ActivityItem = {
  id: string;
  type: "clock_in" | "clock_out" | "report" | "incident" | "patrol";
  timestamp: string;
  userName: string;
  detail: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta?: Record<string, any>;
};

export async function getOperationActivity(eventId: string): Promise<ActivityItem[]> {
  const supabase = createClient();
  const items: ActivityItem[] = [];

  // Timesheets linked to this event
  const { data: timesheets } = await supabase
    .from("timesheets")
    .select("*, users:user_id(first_name, last_name)")
    .eq("event_id", eventId)
    .order("clock_in", { ascending: false })
    .limit(50);
  for (const t of timesheets ?? []) {
    const name = t.users ? `${t.users.first_name} ${t.users.last_name}` : "Unknown";
    items.push({ id: `ci-${t.id}`, type: "clock_in", timestamp: t.clock_in, userName: name, detail: "Clocked in" });
    if (t.clock_out) {
      items.push({ id: `co-${t.id}`, type: "clock_out", timestamp: t.clock_out, userName: name, detail: "Clocked out" });
    }
  }

  // Form submissions linked to this event
  const { data: submissions } = await supabase
    .from("form_submissions")
    .select("*, users:user_id(first_name, last_name), forms(name)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(50);
  for (const s of submissions ?? []) {
    const name = s.users ? `${s.users.first_name} ${s.users.last_name}` : "Unknown";
    items.push({ id: `fr-${s.id}`, type: "report", timestamp: s.created_at, userName: name, detail: s.forms?.name ?? "Field Report", meta: { data: s.data } });
  }

  // Incidents linked to this event
  const { data: incidents } = await supabase
    .from("incidents")
    .select("*, reported_user:users!incidents_reported_by_fkey(first_name, last_name)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(50);
  for (const inc of incidents ?? []) {
    const name = inc.reported_user ? `${inc.reported_user.first_name} ${inc.reported_user.last_name}` : "Unknown";
    items.push({ id: `inc-${inc.id}`, type: "incident", timestamp: inc.created_at, userName: name, detail: inc.title, meta: { severity: inc.severity, status: inc.status } });
  }

  // Sort all items chronologically (newest first)
  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return items;
}
