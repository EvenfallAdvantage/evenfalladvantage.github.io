/**
 * airtable-proxy: server-side Airtable access so the Personal Access Token
 * never reaches the browser. Only the fixed operations the app needs.
 *
 * Auth: user JWT (verify_jwt = true). Caller must be manager or above in the
 * company (the Staff → Applicants "Pull from Airtable" users).
 *
 * Body: { company_id, action: "pull_new_applicants" | "verify" }
 *   pull_new_applicants -> { applicants: [{firstName,lastName,email,phone?,airtableId}] }
 *   verify              -> { connected, tableName? }
 *
 * Token source: Vault (integrations_config.vault_secret_id -> api_key).
 * Transitional fallback: legacy plaintext config.api_key, so The Guardian
 * Team keeps working before the one-time Vault data migration runs.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { readVaultSecret } from "../_shared/email/vault.ts";

const RANK: Record<string, number> = { owner: 60, admin: 50, instructor: 45, manager: 40 };
const AT_API = "https://api.airtable.com/v0";

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Missing bearer token" });
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json(401, { error: "Unauthorized" });

    const body = await req.json().catch(() => null) as { company_id?: string; action?: string } | null;
    if (!body?.company_id || !["pull_new_applicants", "verify"].includes(body.action ?? "")) {
      return json(400, { error: "company_id and a valid action are required" });
    }

    const { data: me } = await admin.from("users").select("id").eq("supabase_id", user.id).maybeSingle();
    const myId = (me as { id?: string } | null)?.id;
    const { data: mem } = myId
      ? await admin.from("company_memberships").select("role").eq("company_id", body.company_id).eq("user_id", myId).maybeSingle()
      : { data: null };
    if ((RANK[(mem as { role?: string } | null)?.role ?? ""] ?? 0) < 40) return json(403, { error: "Forbidden" });

    const { data: row } = await admin
      .from("integrations_config")
      .select("config, is_active, vault_secret_id")
      .eq("company_id", body.company_id)
      .eq("provider", "airtable")
      .maybeSingle();
    const r = row as { config: Record<string, string> | null; is_active: boolean; vault_secret_id: string | null } | null;
    if (!r?.is_active) return json(200, body.action === "verify" ? { connected: false } : { applicants: [] });

    let token = "";
    if (r.vault_secret_id) token = String((await readVaultSecret(admin, r.vault_secret_id)).api_key ?? "");
    if (!token) token = r.config?.api_key ?? ""; // transitional legacy fallback
    const baseId = r.config?.base_id ?? "";
    const table = r.config?.table_name ?? "";
    if (!token || !/^app[A-Za-z0-9]{6,}$/.test(baseId) || !table) {
      return json(200, body.action === "verify" ? { connected: false } : { applicants: [], error: "Airtable is not fully configured" });
    }

    const headers = { Authorization: `Bearer ${token}` };
    const tableUrl = `${AT_API}/${baseId}/${encodeURIComponent(table)}`;

    if (body.action === "verify") {
      const res = await fetch(`${tableUrl}?maxRecords=1`, { headers });
      return json(200, { connected: res.ok, tableName: res.ok ? table : undefined });
    }

    // pull_new_applicants: records with no Overwatch ID yet, max 50 (fixed formula: no injection).
    const params = new URLSearchParams({ filterByFormula: '{Overwatch ID} = ""', maxRecords: "50" });
    // deno-lint-ignore no-explicit-any
    const records: any[] = [];
    let offset: string | undefined;
    do {
      const res = await fetch(`${tableUrl}?${params.toString()}${offset ? `&offset=${encodeURIComponent(offset)}` : ""}`, { headers });
      if (!res.ok) {
        console.error("[airtable-proxy] list failed", res.status);
        return json(502, { error: `Airtable returned ${res.status}` });
      }
      const data = await res.json();
      records.push(...(data.records ?? []));
      offset = data.offset;
    } while (offset && records.length < 50);

    const applicants = records.map((rec) => {
      const f = rec.fields ?? {};
      return {
        firstName: String(f["First Name"] || f["first_name"] || ""),
        lastName: String(f["Last Name"] || f["last_name"] || ""),
        email: String(f["Email"] || f["email"] || ""),
        phone: f["Phone"] ? String(f["Phone"]) : undefined,
        airtableId: String(rec.id),
      };
    }).filter((a) => a.email);
    return json(200, { applicants });
  } catch (err) {
    console.error("[airtable-proxy] error:", err);
    return json(500, { error: "Airtable request failed" });
  }
});
