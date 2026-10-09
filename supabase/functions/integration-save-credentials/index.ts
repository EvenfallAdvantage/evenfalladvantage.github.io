/**
 * integration-save-credentials: write-only credential save for the generic
 * HQ Config integration tiles (Airtable, WhatsApp, ...). Email and SMS keep
 * their own email-save-credentials / sms-save-credentials functions.
 *
 * Auth: user JWT (verify_jwt = true). Caller must be owner/admin.
 *
 * Body: { company_id, provider, config: Record<string,string>, is_active: boolean }
 *   - Secret keys (see _shared/integration-secret-keys.ts) go to Vault, merged
 *     with any secrets already stored (blank = keep existing).
 *   - Non-secret keys stay in integrations_config.config, plus
 *     `secret_keys_set: string[]` so the UI can show "saved" without values.
 *   - Any legacy plaintext secret left in config is moved to Vault on save.
 *
 * Returns: { ok: true, row: {provider, config (redacted), is_active} }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { logAudit } from "../_shared/audit.ts";
import { readVaultSecret, writeVaultSecret } from "../_shared/email/vault.ts";
import { GENERIC_PROVIDERS, isSecretKey, redactConfig, splitConfig } from "../_shared/integration-secret-keys.ts";

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

    const body = await req.json().catch(() => null) as
      | { company_id?: string; provider?: string; config?: Record<string, unknown>; is_active?: boolean }
      | null;
    if (!body?.company_id || !body.provider || !GENERIC_PROVIDERS.has(body.provider)) {
      return json(400, { error: "company_id and a supported provider are required" });
    }

    const { data: me } = await admin.from("users").select("id").eq("supabase_id", user.id).maybeSingle();
    const myId = (me as { id?: string } | null)?.id ?? null;
    const { data: mem } = myId
      ? await admin.from("company_memberships").select("role").eq("company_id", body.company_id).eq("user_id", myId).maybeSingle()
      : { data: null };
    if (!["owner", "admin"].includes((mem as { role?: string } | null)?.role ?? "")) {
      await logAudit(admin, { event_type: "integration.credentials.save", user_id: myId, company_id: body.company_id, outcome: "blocked", metadata: { provider: body.provider } });
      return json(403, { error: "Only owners and admins can change integrations" });
    }

    const { data: existing } = await admin
      .from("integrations_config")
      .select("id, config, vault_secret_id")
      .eq("company_id", body.company_id)
      .eq("provider", body.provider)
      .maybeSingle();
    const ex = existing as { id: string; config: Record<string, unknown> | null; vault_secret_id: string | null } | null;

    const { publicConfig, secrets: incoming } = splitConfig(body.config ?? {});

    // Merge: stored Vault secrets <- legacy plaintext in config <- newly submitted.
    let stored: Record<string, unknown> = {};
    if (ex?.vault_secret_id) stored = await readVaultSecret(admin, ex.vault_secret_id);
    const legacy: Record<string, string> = {};
    for (const [k, v] of Object.entries(ex?.config ?? {})) if (isSecretKey(k) && typeof v === "string" && v) legacy[k] = v;
    const merged = { ...stored, ...legacy, ...incoming } as Record<string, string>;

    let vaultId = ex?.vault_secret_id ?? null;
    if (Object.keys(merged).length) {
      vaultId = await writeVaultSecret(admin, `integration:${body.company_id}:${body.provider}`, merged, vaultId ?? undefined);
    }

    const config = { ...publicConfig, secret_keys_set: Object.keys(merged).sort() };
    const row = {
      company_id: body.company_id,
      provider: body.provider,
      config,
      is_active: !!body.is_active,
      vault_secret_id: vaultId,
      updated_at: new Date().toISOString(),
    };
    const { error: upErr } = await admin.from("integrations_config").upsert(row, { onConflict: "company_id,provider" });
    if (upErr) throw upErr;

    await logAudit(admin, {
      event_type: "integration.credentials.save",
      user_id: myId,
      company_id: body.company_id,
      outcome: "success",
      metadata: { provider: body.provider, secret_keys_changed: Object.keys(incoming), migrated_legacy: Object.keys(legacy) },
    });
    return json(200, { ok: true, row: { provider: body.provider, config: redactConfig(config), is_active: row.is_active } });
  } catch (err) {
    console.error("[integration-save-credentials] error:", err);
    return json(500, { error: "Save failed" });
  }
});
