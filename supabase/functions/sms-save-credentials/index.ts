/**
 * sms-save-credentials - guided save of per-company Twilio credentials to
 * Supabase Vault.
 *
 * Auth: user JWT. Caller must be owner/admin.
 *
 * Body:
 *   {
 *     company_id: uuid,
 *     twilio: {
 *       account_sid: string (AC + 32 hex),
 *       auth_token: string,
 *       from: string (E.164 number or messaging-service SID 'MG...'),
 *     },
 *     from_number?: string (overrides twilio.from for display purposes)
 *   }
 *
 * Flow mirrors email-save-credentials exactly:
 *   1. RBAC check.
 *   2. Validate shape.
 *   3. Upsert vault secret.
 *   4. Patch integrations_config: link vault_secret_id, null verified_at.
 *   5. Audit.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  getCallerIp,
  getCallerUserAgent,
  logAudit,
} from "../_shared/audit.ts";
import { writeVaultSecret } from "../_shared/sms/vault.ts";

interface SaveRequest {
  company_id: string;
  twilio: {
    account_sid: string;
    auth_token: string;
    from: string;
  };
  from_number?: string;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const jsonHeaders = { ...cors, "Content-Type": "application/json" };

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const body = (await req.json()) as SaveRequest;
    if (!body.company_id || !body.twilio) {
      return new Response(
        JSON.stringify({ error: "company_id and twilio required" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const t = body.twilio;
    if (!t.account_sid || !t.auth_token || !t.from) {
      return new Response(
        JSON.stringify({ error: "Twilio requires account_sid, auth_token, and from" }),
        { status: 400, headers: jsonHeaders },
      );
    }
    if (!/^AC[a-f0-9]{32}$/i.test(t.account_sid)) {
      return new Response(
        JSON.stringify({ error: "account_sid looks invalid (should be AC + 32 hex)" }),
        { status: 400, headers: jsonHeaders },
      );
    }
    if (!(/^\+\d{6,15}$/.test(t.from) || /^MG[a-f0-9]{32}$/i.test(t.from))) {
      return new Response(
        JSON.stringify({
          error: "from must be an E.164 number (+15555550100) or a messaging-service SID (MG...)",
        }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const secretPayload = {
      accountSid: t.account_sid.trim(),
      authToken: t.auth_token,
      from: t.from.trim(),
    };

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // RBAC: caller must be owner/admin (mirrors email pattern).
    const { data: callerUserRow } = await admin
      .from("users")
      .select("id")
      .eq("supabase_id", caller.id)
      .maybeSingle();
    let callerMembership:
      | { role: string; users: { id: string } | null }
      | undefined;
    if (callerUserRow) {
      const { data: memRow } = await admin
        .from("company_memberships")
        .select("role")
        .eq("company_id", body.company_id)
        .eq("user_id", (callerUserRow as { id: string }).id)
        .maybeSingle();
      if (memRow) {
        callerMembership = {
          role: (memRow as { role: string }).role,
          users: callerUserRow as { id: string },
        };
      }
    }
    if (!callerMembership || !["owner", "admin"].includes(callerMembership.role)) {
      await logAudit(admin, {
        event_type: "admin.sms.config_save_forbidden",
        company_id: body.company_id,
        outcome: "blocked",
        ip_address: getCallerIp(req),
        user_agent: getCallerUserAgent(req),
      });
      return new Response(
        JSON.stringify({ error: "Forbidden - owner or admin required" }),
        { status: 403, headers: jsonHeaders },
      );
    }

    // Load or create the integrations_config row for SMS.
    const { data: cfgRow, error: cfgErr } = await admin
      .from("integrations_config")
      .select("id, vault_secret_id, delivery_method")
      .eq("company_id", body.company_id)
      .eq("provider", "sms")
      .maybeSingle();
    if (cfgErr) {
      return new Response(
        JSON.stringify({ error: `Config read failed: ${cfgErr.message}` }),
        { status: 500, headers: jsonHeaders },
      );
    }

    // Auto-create the row if it doesn't exist yet (SMS is opt-in; first save
    // creates the integrations_config record).
    if (!cfgRow) {
      const { error: insErr } = await admin
        .from("integrations_config")
        .insert({
          company_id: body.company_id,
          provider: "sms",
          delivery_method: "twilio",
          from_number: body.from_number ?? t.from,
          is_active: true,
          verified_at: null,
        });
      if (insErr) {
        return new Response(
          JSON.stringify({ error: `Config insert failed: ${insErr.message}` }),
          { status: 500, headers: jsonHeaders },
        );
      }
    }

    const secretName = `overwatch.sms.twilio.${body.company_id}`;

    let vaultSecretId: string;
    try {
      const existingId =
        cfgRow?.vault_secret_id && cfgRow.delivery_method === "twilio"
          ? (cfgRow.vault_secret_id as string)
          : undefined;
      vaultSecretId = await writeVaultSecret(admin, secretName, secretPayload, existingId);
    } catch (err) {
      await logAudit(admin, {
        event_type: "admin.sms.config_save_failed",
        company_id: body.company_id,
        user_id: callerMembership.users?.id ?? null,
        outcome: "failure",
        ip_address: getCallerIp(req),
        user_agent: getCallerUserAgent(req),
        metadata: { error: err instanceof Error ? err.message : String(err) },
      });
      return new Response(
        JSON.stringify({
          error: err instanceof Error
            ? `Vault write failed: ${err.message}`
            : "Vault write failed",
        }),
        { status: 500, headers: jsonHeaders },
      );
    }

    const { error: updErr } = await admin
      .from("integrations_config")
      .update({
        delivery_method: "twilio",
        vault_secret_id: vaultSecretId,
        from_number: body.from_number ?? t.from,
        verified_at: null,
      })
      .eq("company_id", body.company_id)
      .eq("provider", "sms");

    if (updErr) {
      return new Response(
        JSON.stringify({ error: `Config update failed: ${updErr.message}` }),
        { status: 500, headers: jsonHeaders },
      );
    }

    await logAudit(admin, {
      event_type: "admin.sms.config_changed",
      company_id: body.company_id,
      user_id: callerMembership.users?.id ?? null,
      outcome: "success",
      ip_address: getCallerIp(req),
      user_agent: getCallerUserAgent(req),
      metadata: {
        delivery_method: "twilio",
        // Do NOT log the secret. Account SID is non-secret per Twilio docs.
        account_sid: t.account_sid,
      },
    });

    return new Response(
      JSON.stringify({ ok: true, vault_secret_id: vaultSecretId, delivery_method: "twilio" }),
      { headers: jsonHeaders },
    );
  } catch (err) {
    // eslint-disable-next-line no-console -- top-level error path
    console.error("[sms-save-credentials] error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
