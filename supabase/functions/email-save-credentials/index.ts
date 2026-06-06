/**
 * email-save-credentials — guided save of per-company email provider
 * credentials to Supabase Vault.
 *
 * Auth: user JWT (verify_jwt = true). Caller must be owner/admin
 * (NOT manager — provider configuration is owner/admin only).
 *
 * Body:
 *   {
 *     company_id: uuid,
 *     delivery_method: "smtp" | "resend",
 *     // SMTP shape:
 *     smtp?: { host: string, port: number, username: string, password: string, secure: boolean },
 *     // Resend shape:
 *     resend?: { api_key: string },
 *   }
 *
 * Flow:
 *   1. RBAC check (owner/admin via company_memberships).
 *   2. Read existing integrations_config row (must already exist —
 *      created by the client when the admin saved the non-secret fields).
 *   3. Build the JSON secret payload matching SmtpConfig / ResendConfig.
 *   4. Upsert into Vault via public.vault_create_secret /
 *      public.vault_update_secret (service-role-only wrappers).
 *   5. Patch integrations_config.vault_secret_id and NULL out
 *      verified_at so the admin has to re-run a test send.
 *   6. Audit-log the change. The raw credentials NEVER touch the response
 *      body or any log line.
 *
 * Returns: { ok: true, vault_secret_id: uuid }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  getCallerIp,
  getCallerUserAgent,
  logAudit,
} from "../_shared/audit.ts";
import { writeVaultSecret } from "../_shared/email/vault.ts";

interface SaveRequest {
  company_id: string;
  delivery_method: "smtp" | "resend";
  smtp?: {
    host: string;
    port: number;
    username: string;
    password: string;
    secure: boolean;
  };
  resend?: {
    api_key: string;
  };
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
    if (!body.company_id || !body.delivery_method) {
      return new Response(
        JSON.stringify({ error: "company_id and delivery_method required" }),
        { status: 400, headers: jsonHeaders },
      );
    }
    if (body.delivery_method !== "smtp" && body.delivery_method !== "resend") {
      return new Response(
        JSON.stringify({ error: "delivery_method must be smtp or resend" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    // Validate shape of the secret payload up-front so we never write
    // a half-formed blob into Vault.
    let secretPayload: Record<string, unknown>;
    if (body.delivery_method === "smtp") {
      const s = body.smtp;
      if (!s || !s.host || !s.port || !s.username || !s.password) {
        return new Response(
          JSON.stringify({
            error: "SMTP requires host, port, username, and password",
          }),
          { status: 400, headers: jsonHeaders },
        );
      }
      if (s.port < 1 || s.port > 65535) {
        return new Response(
          JSON.stringify({ error: "SMTP port must be between 1 and 65535" }),
          { status: 400, headers: jsonHeaders },
        );
      }
      secretPayload = {
        host: s.host.trim(),
        port: Math.floor(s.port),
        username: s.username.trim(),
        password: s.password,
        secure: s.secure === true,
      };
    } else {
      const r = body.resend;
      if (!r || !r.api_key) {
        return new Response(
          JSON.stringify({ error: "Resend requires api_key" }),
          { status: 400, headers: jsonHeaders },
        );
      }
      if (!/^re_[A-Za-z0-9_]{10,}/.test(r.api_key)) {
        return new Response(
          JSON.stringify({
            error: "Resend api_key looks invalid (should start with re_)",
          }),
          { status: 400, headers: jsonHeaders },
        );
      }
      secretPayload = { apiKey: r.api_key };
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // RBAC: caller must be owner/admin in the target company.
    const { data: roleRows } = await admin
      .from("company_memberships")
      .select("role, users:users!company_memberships_user_id_fkey(id)")
      .eq("company_id", body.company_id)
      .eq("users.supabase_id", caller.id);
    const callerMembership = (roleRows ?? [])[0] as
      | { role: string; users: { id: string } | null }
      | undefined;
    if (
      !callerMembership ||
      !["owner", "admin"].includes(callerMembership.role)
    ) {
      await logAudit(admin, {
        event_type: "admin.email.config_save_forbidden",
        company_id: body.company_id,
        outcome: "blocked",
        ip_address: getCallerIp(req),
        user_agent: getCallerUserAgent(req),
      });
      return new Response(
        JSON.stringify({ error: "Forbidden — owner or admin required" }),
        { status: 403, headers: jsonHeaders },
      );
    }

    // Load existing row so we know whether to update or create a vault
    // secret (and whether the integrations_config row even exists).
    const { data: cfgRow, error: cfgErr } = await admin
      .from("integrations_config")
      .select("id, vault_secret_id, delivery_method")
      .eq("company_id", body.company_id)
      .eq("provider", "email")
      .maybeSingle();
    if (cfgErr) {
      return new Response(
        JSON.stringify({ error: `Config read failed: ${cfgErr.message}` }),
        { status: 500, headers: jsonHeaders },
      );
    }
    if (!cfgRow) {
      return new Response(
        JSON.stringify({
          error:
            "Save the non-secret email config (from name, from email) first.",
        }),
        { status: 400, headers: jsonHeaders },
      );
    }

    // Build a deterministic secret name so we don't accumulate orphans
    // across saves: one secret per (company_id, delivery_method).
    const secretName =
      `overwatch.email.${body.delivery_method}.${body.company_id}`;

    let vaultSecretId: string;
    try {
      // If a vault_secret_id is already linked AND the delivery method
      // matches, update in place. Otherwise create a fresh secret and let
      // the previous one age out (we don't delete the old one — keeping
      // it lets the admin revert via the dashboard if needed).
      const existingId =
        cfgRow.vault_secret_id &&
            cfgRow.delivery_method === body.delivery_method
          ? (cfgRow.vault_secret_id as string)
          : undefined;
      vaultSecretId = await writeVaultSecret(
        admin,
        secretName,
        secretPayload,
        existingId,
      );
    } catch (err) {
      await logAudit(admin, {
        event_type: "admin.email.config_save_failed",
        company_id: body.company_id,
        user_id: callerMembership.users?.id ?? null,
        outcome: "failure",
        ip_address: getCallerIp(req),
        user_agent: getCallerUserAgent(req),
        metadata: {
          delivery_method: body.delivery_method,
          error: err instanceof Error ? err.message : String(err),
        },
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

    // Patch integrations_config: link the new vault secret id, update
    // delivery_method (in case it changed), and NULL verified_at so the
    // admin has to re-verify with a test send.
    const { error: updErr } = await admin
      .from("integrations_config")
      .update({
        delivery_method: body.delivery_method,
        vault_secret_id: vaultSecretId,
        verified_at: null,
      })
      .eq("company_id", body.company_id)
      .eq("provider", "email");

    if (updErr) {
      return new Response(
        JSON.stringify({ error: `Config update failed: ${updErr.message}` }),
        { status: 500, headers: jsonHeaders },
      );
    }

    await logAudit(admin, {
      event_type: "admin.email.config_changed",
      company_id: body.company_id,
      user_id: callerMembership.users?.id ?? null,
      outcome: "success",
      ip_address: getCallerIp(req),
      user_agent: getCallerUserAgent(req),
      metadata: {
        delivery_method: body.delivery_method,
        // DO NOT log the secret payload. Only metadata that can't be used
        // to reconstruct creds.
        smtp_host: body.delivery_method === "smtp" ? body.smtp?.host : null,
        smtp_port: body.delivery_method === "smtp" ? body.smtp?.port : null,
      },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        vault_secret_id: vaultSecretId,
        delivery_method: body.delivery_method,
      }),
      { headers: jsonHeaders },
    );
  } catch (err) {
    // eslint-disable-next-line no-console -- top-level error path
    console.error("[email-save-credentials] error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
