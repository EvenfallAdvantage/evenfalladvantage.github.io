import { createClient } from "./client";

// ─── Client Intake Tokens ─────────────────────────────

export type IntakeSource = "hosted" | "api" | "webhook";

export type IntakeTokenRow = {
  id: string;
  company_id: string;
  event_id: string | null;
  token: string;
  client_name: string | null;
  client_email: string | null;
  data: Record<string, unknown>;
  status: "active" | "submitted" | "expired" | "revoked";
  created_by: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  source?: IntakeSource;
  api_key_id?: string | null;
  raw_payload?: Record<string, unknown> | null;
  submitted_at?: string | null;
  companies?: { name: string; logo_url: string | null; brand_color: string; website_url: string | null };
};

/**
 * True when PostgREST says the RPC does not exist yet (migration
 * 20261006200000_intake_tokens_rls not applied). Lets this code ship before
 * the migration; remove the fallbacks once it is applied.
 */
function isMissingRpc(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "PGRST202" || error.code === "42883";
}

/**
 * Public client-intake page: load one shared-link intake by its token.
 * Uses the get_intake_by_token RPC (SECURITY DEFINER, one row, limited
 * fields), so the anon key no longer needs read access to the table.
 */
export async function getIntakeByToken(token: string): Promise<IntakeTokenRow | null> {
  const supabase = createClient();
  const rpc = await supabase.rpc("get_intake_by_token", { p_token: token });
  if (!rpc.error) return (rpc.data as IntakeTokenRow | null) ?? null;
  if (!isMissingRpc(rpc.error)) throw rpc.error;

  // Legacy path (pre-migration).
  const { data, error } = await supabase
    .from("client_intake_tokens")
    .select("*, companies(name, logo_url, brand_color, website_url)")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function submitIntakeData(token: string, payload: {
  clientName: string;
  clientEmail: string;
  data: Record<string, unknown>;
}) {
  const supabase = createClient();
  const rpc = await supabase.rpc("submit_intake_by_token", {
    p_token: token,
    p_client_name: payload.clientName,
    p_client_email: payload.clientEmail,
    p_data: payload.data,
  });
  if (!rpc.error) {
    if (!rpc.data) throw new Error("This intake link is no longer active.");
    return rpc.data;
  }
  if (!isMissingRpc(rpc.error)) throw rpc.error;

  // Legacy path (pre-migration).
  const { data, error } = await supabase
    .from("client_intake_tokens")
    .update({
      client_name: payload.clientName,
      client_email: payload.clientEmail,
      data: payload.data,
      status: "submitted",
      updated_at: new Date().toISOString(),
    })
    .eq("token", token)
    .in("status", ["active", "submitted"])
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createIntakeToken(params: {
  companyId: string;
  eventId?: string;
  createdBy: string;
  expiresAt?: string;
}): Promise<IntakeTokenRow> {
  const supabase = createClient();
  // 32 hex chars (128 bits). Older 16-char tokens keep working.
  const token = crypto.randomUUID().replace(/-/g, "");
  const { data, error } = await supabase
    .from("client_intake_tokens")
    .insert({
      id: crypto.randomUUID(),
      company_id: params.companyId,
      event_id: params.eventId ?? null,
      token,
      status: "active",
      data: {},
      created_by: params.createdBy,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: params.expiresAt ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getIntakeTokens(
  companyId: string,
  options?: { eventId?: string },
): Promise<IntakeTokenRow[]> {
  const supabase = createClient();
  let query = supabase
    .from("client_intake_tokens")
    .select("*")
    .eq("company_id", companyId);
  if (options?.eventId) {
    query = query.eq("event_id", options.eventId);
  }
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function revokeIntakeToken(tokenId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("client_intake_tokens")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("id", tokenId);
  if (error) throw error;
}
