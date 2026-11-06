import { createClient } from "./client";
import { CONNECTION_SELECT, isMissingTableError, type IntegrationConnection } from "@/lib/integrations/connections";

/** Vendor connections for a company. Returns [] until the V0 migration is applied. */
export async function getIntegrationConnections(companyId: string): Promise<IntegrationConnection[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("integration_connections")
    .select(CONNECTION_SELECT)
    .eq("company_id", companyId);
  if (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
  return (data ?? []) as unknown as IntegrationConnection[];
}

async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const supabase = createClient();
  // getUser refreshes a stale access token. getSession alone can still hold
  // the expired one, and the function then rejects it before checking a role.
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Not signed in");
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not signed in");
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error("Supabase URL missing");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (anon) headers.apikey = anon;
  const res = await fetch(`${base.replace(/\/+$/, "")}/functions/v1/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const out = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(out.error ?? `Request failed (${res.status})`);
  return out;
}

/** test / disconnect / vendor actions, via integration-action. */
export function runIntegrationAction<T = unknown>(companyId: string, provider: string, action: string, input?: Record<string, unknown>) {
  return callFunction<{ ok: boolean; detail?: string | null; status?: string; result?: T }>("integration-action", {
    company_id: companyId, provider, action, input: input ?? {},
  });
}

const AIRTABLE_SETTING_KEYS = ["base_id", "base_name", "table_id", "table_name"] as const;

/** Persist the base and table an owner picked. The database trigger drops anything else. */
export async function saveIntegrationConnectionSettings(companyId: string, provider: string, settings: Record<string, string>): Promise<IntegrationConnection> {
  const clean: Record<string, string> = {};
  for (const key of AIRTABLE_SETTING_KEYS) {
    const value = settings[key];
    if (typeof value === "string" && value.trim()) clean[key] = value.trim();
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("integration_connections")
    .update({ settings: clean })
    .eq("company_id", companyId)
    .eq("provider", provider)
    .select(CONNECTION_SELECT)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Could not save these settings. Only an owner or admin of this company can.");
  return data as unknown as IntegrationConnection;
}

/** Returns the vendor authorize URL; the caller redirects the browser to it. */
export async function startIntegrationOAuth(companyId: string, provider: string): Promise<string> {
  const { url } = await callFunction<{ url: string }>("integration-oauth-start", {
    company_id: companyId, provider, redirect_after: "/admin/settings",
  });
  return url;
}
