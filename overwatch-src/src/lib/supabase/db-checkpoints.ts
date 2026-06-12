import { createClient } from "./client";
import { ts, ensureInternalUser } from "./db-helpers";
import { logDbReadError } from "./db-error";

// ─── Checkpoints & Patrol ────────────────────────────

export async function getCheckpoints(companyId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("checkpoints")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) { logDbReadError("checkpoints", error); return []; }
  return data ?? [];
}

export async function getAbcCheckpoints(companyId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("checkpoints")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_abc_checkpoint", true)
    .eq("is_active", true)
    .order("name");
  if (error) { logDbReadError("ABC checkpoints", error); return []; }
  return data ?? [];
}

export async function createCheckpoint(companyId: string, params: {
  name: string; description?: string; location?: string; eventId?: string;
  isAbcCheckpoint?: boolean; abcCertificationType?: string; requiredCertifications?: string[];
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
    is_abc_checkpoint: params.isAbcCheckpoint ?? false,
    abc_certification_type: params.abcCertificationType ?? null,
    required_certifications: params.requiredCertifications ?? [],
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
  const { data, error } = await supabase
    .from("patrol_routes")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name");
  if (error) { logDbReadError("patrol routes", error); return []; }
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
  const { data, error } = await supabase
    .from("patrol_logs")
    .select("*, checkpoints(name, location), users(first_name, last_name)")
    .eq("company_id", companyId)
    .order("scanned_at", { ascending: false })
    .limit(limit);
  if (error) { logDbReadError("patrol logs", error); return []; }
  return data ?? [];
}
