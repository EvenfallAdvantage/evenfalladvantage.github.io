import { createClient } from "./client";
import { ensureInternalUser } from "./db-helpers";

function logErr(context: string, error: unknown) {
  console.error(`[DB] ${context}:`, error);
}

export async function getRadioFrequencies(companyId: string, state?: string, category?: string) {
  const supabase = createClient();
  let query = supabase
    .from("radio_frequencies")
    .select("*")
    .or(`company_id.eq.${companyId},is_reference.eq.true`);
  if (state) query = query.eq("state", state);
  if (category) query = query.eq("category", category);
  const { data, error } = await query.order("priority", { ascending: true }).order("frequency", { ascending: true });
  if (error) { logErr("radio frequencies", error); return []; }
  return data ?? [];
}

export async function getRadioFrequency(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase.from("radio_frequencies").select("*").eq("id", id).maybeSingle();
  if (error) { logErr("radio frequency", error); return null; }
  return data;
}

export async function createRadioFrequency(params: {
  companyId: string;
  name: string;
  frequency: number;
  mode?: string;
  band?: string;
  ctcss_dcs?: string;
  description?: string;
  category?: string;
  state?: string;
  city?: string;
  county?: string;
  priority?: number;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("radio_frequencies")
    .insert({
      id: crypto.randomUUID(),
      company_id: params.companyId,
      name: params.name,
      frequency: params.frequency,
      mode: params.mode ?? "FM",
      band: params.band ?? null,
      ctcss_dcs: params.ctcss_dcs ?? null,
      description: params.description ?? null,
      category: params.category ?? "custom",
      state: params.state ?? null,
      city: params.city ?? null,
      county: params.county ?? null,
      priority: params.priority ?? 5,
      is_reference: false,
      created_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateRadioFrequency(id: string, updates: Record<string, unknown>) {
  const supabase = createClient();
  const clean = { ...updates };
  delete clean.id;
  delete clean.is_reference;
  delete clean.created_at;
  const { data, error } = await supabase
    .from("radio_frequencies")
    .update(clean)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteRadioFrequency(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("radio_frequencies").delete().eq("id", id);
  if (error) throw error;
}

export async function searchFrequencies(companyId: string, query: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("radio_frequencies")
    .select("*")
    .or(`company_id.eq.${companyId},is_reference.eq.true`)
    .or(`name.ilike.%${query}%,frequency::text.ilike.%${query}%`)
    .order("priority", { ascending: true })
    .limit(50);
  if (error) { logErr("frequency search", error); return []; }
  return data ?? [];
}

export async function getRadioNodes(companyId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("radio_nodes")
    .select("*")
    .eq("company_id", companyId)
    .order("last_seen", { ascending: false });
  if (error) { logErr("radio nodes", error); return []; }
  return data ?? [];
}

export async function getRadioLogs(companyId: string, limit = 50) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("radio_logs")
    .select("*")
    .eq("company_id", companyId)
    .order("logged_at", { ascending: false })
    .limit(limit);
  if (error) { logErr("radio logs", error); return []; }
  return data ?? [];
}

export async function logRadioActivity(params: {
  companyId: string;
  userId?: string;
  nodeId?: string;
  frequencyId?: string;
  direction?: string;
  mode?: string;
  content?: string;
  signalStrength?: number;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("radio_logs")
    .insert({
      id: crypto.randomUUID(),
      company_id: params.companyId,
      user_id: params.userId ?? null,
      node_id: params.nodeId ?? null,
      frequency_id: params.frequencyId ?? null,
      direction: params.direction ?? "rx",
      mode: params.mode ?? null,
      content: params.content ?? null,
      signal_strength: params.signalStrength ?? null,
      logged_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getCompanyRadioState(companyId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("radio_state")
    .eq("id", companyId)
    .maybeSingle();
  if (error) { logErr("company radio state", error); return null; }
  return data?.radio_state ?? null;
}

export async function setCompanyRadioState(companyId: string, state: string | null) {
  const supabase = createClient();
  const { error } = await supabase
    .from("companies")
    .update({ radio_state: state })
    .eq("id", companyId);
  if (error) throw error;
}

export async function getUserRadioStates(companyId: string) {
  const userId = await ensureInternalUser();
  if (!userId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("company_memberships")
    .select("radio_states")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) { logErr("user radio states", error); return []; }
  return (data?.radio_states as string[]) ?? [];
}

export async function setUserRadioStates(companyId: string, states: string[]) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("No authenticated user");
  const supabase = createClient();
  const { error } = await supabase
    .from("company_memberships")
    .update({ radio_states: states })
    .eq("company_id", companyId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function getActiveRadioStates(companyId: string) {
  const [companyState, userStates] = await Promise.all([
    getCompanyRadioState(companyId),
    getUserRadioStates(companyId),
  ]);
  if (userStates.length > 0) return userStates;
  if (companyState) return [companyState];
  return [];
}
