/**
 * email-test-send — exercise the company's configured email provider with a
 * REAL send. On success, stamp integrations_config.verified_at so the
 * provider becomes the live transport for future invitation / broadcast /
 * welcome / etc. sends. On failure, return the provider's error text and
 * leave verified_at NULL (the factory will keep falling back to platform).
 *
 * Auth: user JWT (verify_jwt = true). Caller must be owner/admin
 * (NOT manager — provider configuration is owner/admin only).
 *
 * Body:
 *   {
 *     company_id: uuid,
 *     to_email: string,    // where to send the test (usually the admin's own address)
 *   }
 *
 * Returns:
 *   { ok: true, delivery_method, provider_message_id?, verified_at }
 *   or
 *   { ok: false, error }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  getCallerIp,
  getCallerUserAgent,
  logAudit,
} from "../_shared/audit.ts";
import { buildTestSendEmail } from "../_shared/email/templates.ts";
import { resolveProviderForCompany } from "../_shared/email/factory.ts";

interface TestSendRequest {
  company_id: string;
  to_email: string;
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

    const body = (await req.json()) as TestSendRequest;
    if (!body.company_id || !body.to_email) {
      return new Response(
        JSON.stringify({ error: "company_id and to_email required" }),
        { status: 400, headers: jsonHeaders },
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.to_email)) {
      return new Response(
        JSON.stringify({ error: "to_email is not a valid email address" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Provider config is owner/admin-gated. is_company_admin includes
    // manager too, so we do an explicit role check here.
    const { data: roleRows } = await admin
      .from("company_memberships")
      .select("role, users:users!company_memberships_user_id_fkey(id, email, first_name, last_name)")
      .eq("company_id", body.company_id)
      .eq("users.supabase_id", caller.id);
    const callerMembership = (roleRows ?? [])[0] as
      | {
        role: string;
        users: {
          id: string;
          email: string;
          first_name: string;
          last_name: string;
        } | null;
      }
      | undefined;
    if (
      !callerMembership ||
      !["owner", "admin"].includes(callerMembership.role)
    ) {
      await logAudit(admin, {
        event_type: "admin.email.test_send_forbidden",
        company_id: body.company_id,
        user_id: null,
        outcome: "blocked",
        ip_address: getCallerIp(req),
        user_agent: getCallerUserAgent(req),
      });
      return new Response(
        JSON.stringify({ error: "Forbidden — owner or admin required" }),
        { status: 403, headers: jsonHeaders },
      );
    }
    const callerName =
      [
        callerMembership.users?.first_name,
        callerMembership.users?.last_name,
      ].filter(Boolean).join(" ") ||
      callerMembership.users?.email || caller.email || "Admin";

    // Resolve the company's CONFIGURED provider — but bypass the
    // verified_at gate so a freshly-saved (still-unverified) row can be
    // tested. We do this by reading the row directly + building the
    // provider with the same factory logic the production path uses.
    const { data: cfgRow, error: cfgErr } = await admin
      .from("integrations_config")
      .select(
        "delivery_method, from_email, from_name, reply_to, vault_secret_id, is_active",
      )
      .eq("company_id", body.company_id)
      .eq("provider", "email")
      .maybeSingle();
    if (cfgErr) {
      return new Response(
        JSON.stringify({ error: `Config read failed: ${cfgErr.message}` }),
        { status: 500, headers: jsonHeaders },
      );
    }
    if (!cfgRow || !cfgRow.is_active || !cfgRow.delivery_method) {
      return new Response(
        JSON.stringify({
          error: "No active email provider configured for this company",
        }),
        { status: 400, headers: jsonHeaders },
      );
    }

    // Resolve company name.
    const { data: company } = await admin
      .from("companies")
      .select("name")
      .eq("id", body.company_id)
      .single();
    const companyName = company?.name ?? "Overwatch";

    // Temporarily stamp verified_at so the factory uses the company's
    // own provider for this one test send. We restore the original
    // value at the end (or leave verified if the send succeeded).
    const { error: tmpStampErr } = await admin
      .from("integrations_config")
      .update({ verified_at: new Date().toISOString() })
      .eq("company_id", body.company_id)
      .eq("provider", "email");
    if (tmpStampErr) {
      return new Response(
        JSON.stringify({
          error: `Failed to stamp verified_at for test: ${tmpStampErr.message}`,
        }),
        { status: 500, headers: jsonHeaders },
      );
    }

    const factory = await resolveProviderForCompany(
      admin,
      body.company_id,
      companyName,
    );

    const { subject, html, text } = buildTestSendEmail({
      companyName,
      deliveryMethod: factory.provider.kind,
      fromEmail: factory.defaultFrom.email,
      triggeredBy: callerName,
    });

    const sendResult = await factory.provider.send({
      to: [{ email: body.to_email }],
      from: factory.defaultFrom,
      replyTo: factory.defaultReplyTo,
      subject,
      html,
      text,
    });

    const ok = sendResult.rejected.length === 0 &&
      sendResult.accepted.length > 0;
    const failureReason = sendResult.rejected[0]?.reason;

    // On success keep verified_at stamped (and record test_sent_to).
    // On failure, restore verified_at to NULL so the factory falls back.
    if (ok) {
      await admin
        .from("integrations_config")
        .update({ test_sent_to: body.to_email })
        .eq("company_id", body.company_id)
        .eq("provider", "email");

      // Log the successful send.
      await admin.from("email_send_log").insert({
        company_id: body.company_id,
        delivery_method: factory.provider.kind,
        to_email: body.to_email,
        from_email: factory.defaultFrom.email,
        subject,
        purpose: "test_send",
        status: "sent",
        provider_id: sendResult.providerMessageId,
        metadata: { used_fallback: factory.usedFallback },
      });
    } else {
      await admin
        .from("integrations_config")
        .update({ verified_at: null })
        .eq("company_id", body.company_id)
        .eq("provider", "email");

      await admin.from("email_send_log").insert({
        company_id: body.company_id,
        delivery_method: factory.provider.kind,
        to_email: body.to_email,
        from_email: factory.defaultFrom.email,
        subject,
        purpose: "test_send",
        status: "failed",
        error_message: failureReason ?? "unknown",
        metadata: { used_fallback: factory.usedFallback },
      });
    }

    await logAudit(admin, {
      event_type: ok
        ? "admin.email.config_verified"
        : "admin.email.config_test_failed",
      company_id: body.company_id,
      user_id: callerMembership.users?.id ?? null,
      outcome: ok ? "success" : "failure",
      ip_address: getCallerIp(req),
      user_agent: getCallerUserAgent(req),
      metadata: {
        delivery_method: factory.provider.kind,
        to_email: body.to_email,
        error: failureReason,
      },
    });

    if (!ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          delivery_method: factory.provider.kind,
          error: failureReason ?? "Unknown send failure",
        }),
        { status: 502, headers: jsonHeaders },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        delivery_method: factory.provider.kind,
        provider_message_id: sendResult.providerMessageId,
        verified_at: new Date().toISOString(),
      }),
      { headers: jsonHeaders },
    );
  } catch (err) {
    // eslint-disable-next-line no-console -- top-level error path
    console.error("[email-test-send] error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
