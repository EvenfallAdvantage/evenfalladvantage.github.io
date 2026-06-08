/**
 * sms-test-send - send a verification SMS to confirm the company's Twilio
 * configuration works end-to-end, then stamp integrations_config.verified_at.
 *
 * Auth: user JWT. Caller must be owner/admin.
 *
 * Body:
 *   {
 *     company_id: uuid,
 *     to: string (E.164),
 *   }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  getCallerIp,
  getCallerUserAgent,
  logAudit,
} from "../_shared/audit.ts";

interface TestRequest {
  company_id: string;
  to: string;
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

    const body = (await req.json()) as TestRequest;
    if (!body.company_id || !body.to || !/^\+\d{6,15}$/.test(body.to)) {
      return new Response(
        JSON.stringify({ error: "company_id and E.164 'to' required" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // RBAC: owner/admin only.
    const { data: callerUserRow } = await admin
      .from("users")
      .select("id")
      .eq("supabase_id", caller.id)
      .maybeSingle();
    let role = "";
    if (callerUserRow) {
      const { data: memRow } = await admin
        .from("company_memberships")
        .select("role")
        .eq("company_id", body.company_id)
        .eq("user_id", (callerUserRow as { id: string }).id)
        .maybeSingle();
      role = (memRow as { role?: string })?.role ?? "";
    }
    if (!["owner", "admin"].includes(role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    // Dispatch a test SMS via sms-send.
    const smsSendUrl = `${supabaseUrl}/functions/v1/sms-send`;
    const dispatch = await fetch(smsSendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        company_id: body.company_id,
        to: body.to,
        body: "Overwatch SMS test - your Twilio integration is working.",
        purpose: "test_send",
      }),
    });
    const result = (await dispatch.json()) as Record<string, unknown>;

    const accepted = Array.isArray(result.accepted) ? result.accepted as string[] : [];
    if (!dispatch.ok || accepted.length === 0) {
      await logAudit(admin, {
        event_type: "admin.sms.config_test_failed",
        company_id: body.company_id,
        user_id: (callerUserRow as { id?: string } | null)?.id ?? null,
        outcome: "failure",
        ip_address: getCallerIp(req),
        user_agent: getCallerUserAgent(req),
        metadata: {
          error: result.error,
          rejected: result.rejected,
          delivery_method: result.delivery_method,
        },
      });
      return new Response(
        JSON.stringify({
          ok: false,
          error: result.error ?? "Send failed",
          details: result,
        }),
        { status: 502, headers: jsonHeaders },
      );
    }

    // Stamp verified_at on the integrations_config row.
    const { error: stampErr } = await admin
      .from("integrations_config")
      .update({
        verified_at: new Date().toISOString(),
        test_sent_to: body.to,
      })
      .eq("company_id", body.company_id)
      .eq("provider", "sms");
    if (stampErr) {
      // eslint-disable-next-line no-console
      console.warn("[sms-test-send] verified_at stamp failed:", stampErr.message);
    }

    await logAudit(admin, {
      event_type: "admin.sms.config_verified",
      company_id: body.company_id,
      user_id: (callerUserRow as { id?: string } | null)?.id ?? null,
      outcome: "success",
      ip_address: getCallerIp(req),
      user_agent: getCallerUserAgent(req),
      metadata: {
        delivery_method: result.delivery_method,
        used_fallback: result.used_fallback,
      },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        delivery_method: result.delivery_method,
        used_fallback: result.used_fallback,
        provider_id: result.provider_id,
      }),
      { headers: jsonHeaders },
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[sms-test-send] error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
