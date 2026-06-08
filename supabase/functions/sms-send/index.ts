/**
 * sms-send — generic per-company SMS dispatcher.
 *
 * Designed to be called from OTHER Edge Functions (sms-reply-to-reporter,
 * future broadcast / shift-reminder paths) using the service-role key.
 * Auth is therefore by service-role key in the Authorization header — NOT by
 * user JWT.
 *
 * Body:
 *   {
 *     company_id: uuid,
 *     to: string,                       // E.164 phone number
 *     body: string,                     // message text
 *     from_override?: string,           // E.164 or messaging-service SID
 *     purpose: 'reporter_reply' | 'broadcast' | 'shift_reminder'
 *            | 'test_send' | 'other',
 *     submission_id?: uuid,             // for reporter-reply audit
 *     idempotency_key?: string,
 *   }
 *
 * Returns: { delivery_method, used_fallback, accepted, rejected, provider_id }
 *
 * Side effects: writes one row to sms_send_log.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { resolveSmsProviderForCompany } from "../_shared/sms/factory.ts";
import type { SmsMessage } from "../_shared/sms/types.ts";

interface SendRequest {
  company_id: string;
  to: string;
  body: string;
  from_override?: string;
  purpose:
    | "reporter_reply"
    | "broadcast"
    | "shift_reminder"
    | "test_send"
    | "other";
  submission_id?: string;
  idempotency_key?: string;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const jsonHeaders = { ...cors, "Content-Type": "application/json" };

  try {
    // Service-role gate.
    const authHeader = req.headers.get("authorization") ?? "";
    const expectedServiceKey = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`;
    if (!authHeader || authHeader !== expectedServiceKey) {
      return new Response(
        JSON.stringify({ error: "Forbidden - service-role auth required" }),
        { status: 403, headers: jsonHeaders },
      );
    }

    const body = (await req.json()) as SendRequest;
    if (!body.company_id || !body.to || !body.body || !body.purpose) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const factory = await resolveSmsProviderForCompany(supabaseService, body.company_id);
    const from = body.from_override ?? factory.defaultFrom;

    const message: SmsMessage = {
      to: body.to,
      from,
      body: body.body,
      idempotencyKey: body.idempotency_key,
    };

    const result = await factory.provider.send(message);

    const status = result.accepted.length > 0 ? "sent" : "rejected";
    const errorMessage = result.rejected[0]?.reason ?? null;

    const { error: logErr } = await supabaseService
      .from("sms_send_log")
      .insert({
        company_id: body.company_id,
        delivery_method: factory.provider.kind,
        to_number: body.to,
        from_number: from,
        body: body.body,
        purpose: body.purpose,
        status,
        provider_id: result.providerMessageId,
        error_message: errorMessage,
        submission_id: body.submission_id ?? null,
        metadata: { used_fallback: factory.usedFallback },
      });
    if (logErr) {
      // eslint-disable-next-line no-console -- log is best-effort
      console.warn("[sms-send] log write failed:", logErr.message);
    }

    return new Response(
      JSON.stringify({
        delivery_method: factory.provider.kind,
        used_fallback: factory.usedFallback,
        accepted: result.accepted,
        rejected: result.rejected,
        provider_id: result.providerMessageId,
      }),
      { headers: jsonHeaders },
    );
  } catch (err) {
    // eslint-disable-next-line no-console -- top-level error path
    console.error("[sms-send] error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
