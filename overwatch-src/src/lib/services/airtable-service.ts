/**
 * Airtable (applicant intake), server-side via the `airtable-proxy` Edge
 * Function. The Personal Access Token lives in Vault and never reaches the
 * browser.
 */
import { createClient } from "@/lib/supabase/client";

export interface AirtableApplicant { firstName: string; lastName: string; email: string; phone?: string; airtableId: string }

async function callProxy<T>(companyId: string, action: "pull_new_applicants" | "verify"): Promise<T> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error("Supabase URL missing");
  const res = await fetch(`${base.replace(/\/+$/, "")}/functions/v1/airtable-proxy`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ company_id: companyId, action }),
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Airtable request failed (${res.status})`);
  return body;
}

/** Pull Airtable records with no "Overwatch ID" yet (max 50). */
export async function pullNewApplicantsFromAirtable(companyId: string): Promise<AirtableApplicant[]> {
  const r = await callProxy<{ applicants?: AirtableApplicant[] }>(companyId, "pull_new_applicants");
  return r.applicants ?? [];
}

export async function verifyAirtableConnection(companyId: string): Promise<{ connected: boolean; tableName?: string }> {
  try { return await callProxy<{ connected: boolean; tableName?: string }>(companyId, "verify"); }
  catch { return { connected: false }; }
}
