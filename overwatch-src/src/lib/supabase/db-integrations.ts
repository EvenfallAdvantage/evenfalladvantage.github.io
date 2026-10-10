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
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error("Supabase URL missing");
  const res = await fetch(`${base.replace(/\/+$/, "")}/functions/v1/${name}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const out = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(out.error ?? `Request failed (${res.status})`);
  return out;
}

/** test / disconnect / vendor actions, via integration-action. */
export function runIntegrationAction(companyId: string, provider: string, action: string, input?: Record<string, unknown>) {
  return callFunction<{ ok: boolean; detail?: string | null; status?: string }>("integration-action", {
    company_id: companyId, provider, action, input: input ?? {},
  });
}

/** Returns the vendor authorize URL; the caller redirects the browser to it. */
export async function startIntegrationOAuth(companyId: string, provider: string): Promise<string> {
  const { url } = await callFunction<{ url: string }>("integration-oauth-start", {
    company_id: companyId, provider, redirect_after: "/admin/settings",
  });
  return url;
}
