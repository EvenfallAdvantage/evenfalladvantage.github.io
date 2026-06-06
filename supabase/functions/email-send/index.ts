/**
 * email-send — generic per-company email dispatcher.
 *
 * Designed to be called from OTHER Edge Functions (roster-invite,
 * roster-bulk-email, future welcome / shift-reminder / time-change paths)
 * using the service-role key. Auth is therefore by service-role key in the
 * Authorization header — NOT by user JWT.
 *
 * Body:
 *   {
 *     company_id: uuid,
 *     to: Array<{ email, name? }>,
 *     subject: string,
 *     html: string,
 *     text?: string,
 *     reply_to?: { email, name? },
 *     from_override?: { email, name? },  // rare; defaults to per-company
 *     purpose: 'invitation' | 'broadcast' | 'shift_reminder' | 'time_change'
 *            | 'welcome' | 'test_send' | 'other',
 *     idempotency_key?: string,
 *     headers?: Record<string,string>,
 *   }
 *
 * Returns: { delivery_method, results: SendResult, used_fallback }
 *
 * Side effects: writes one row per recipient to email_send_log.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { resolveProviderForCompany } from "../_shared/email/factory.ts";
import type { EmailMessage } from "../_shared/email/types.ts";

interface SendRequest {
  company_id: string;
  to: Array<{ email: string; name?: string }>;
  subject: string;
  html: string;
  text?: string;
  reply_to?: { email: string; name?: string };
  from_override?: { email: string; name?: string };
  purpose:
    | "invitation"
    | "broadcast"
    | "shift_reminder"
    | "time_change"
    | "welcome"
    | "test_send"
    | "other";
  idempotency_key?: string;
  headers?: Record<string, string>;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const jsonHeaders = { ...cors, "Content-Type": "application/json" };

  try {
    // Service-role gate: caller MUST present the service-role key. This
    // function is internal — there's no user-callable endpoint surface.
    const authHeader = req.headers.get("authorization") ?? "";
    const expectedServiceKey =
      `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`;
    if (!authHeader || authHeader !== expectedServiceKey) {
      return new Response(
        JSON.stringify({ error: "Forbidden — service-role auth required" }),
        { status: 403, headers: jsonHeaders },
      );
    }

    const body = (await req.json()) as SendRequest;
    if (!body.company_id || !body.to?.length || !body.subject || !body.html) {
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

    // Resolve company name for branding.
    const { data: company } = await supabaseService
      .from("companies")
      .select("name")
      .eq("id", body.company_id)
      .single();
    const companyName = company?.name ?? "Overwatch";

    const factory = await resolveProviderForCompany(
      supabaseService,
      body.company_id,
      companyName,
    );

    const from =
      body.from_override ?? factory.defaultFrom;
    const replyTo = body.reply_to ?? factory.defaultReplyTo;

    const message: EmailMessage = {
      to: body.to,
      from,
      replyTo,
      subject: body.subject,
      html: body.html,
      text: body.text,
      headers: body.headers,
      idempotencyKey: body.idempotency_key,
    };

    const result = await factory.provider.send(message);

    // Log every send (accepted + rejected) into email_send_log.
    const logRows = [
      ...result.accepted.map((toEmail) => ({
        company_id: body.company_id,
        delivery_method: factory.provider.kind,
        to_email: toEmail,
        from_email: from.email,
        subject: body.subject,
        purpose: body.purpose,
        status: "sent" as const,
        provider_id: result.providerMessageId,
        metadata: { used_fallback: factory.usedFallback },
      })),
      ...result.rejected.map((r) => ({
        company_id: body.company_id,
        delivery_method: factory.provider.kind,
        to_email: r.to,
        from_email: from.email,
        subject: body.subject,
        purpose: body.purpose,
        status: "rejected" as const,
        provider_id: result.providerMessageId,
        error_message: r.reason,
        metadata: { used_fallback: factory.usedFallback },
      })),
    ];
    if (logRows.length > 0) {
      const { error: logErr } = await supabaseService
        .from("email_send_log")
        .insert(logRows);
      if (logErr) {
        // eslint-disable-next-line no-console -- log is best-effort; do not fail the send
        console.warn("[email-send] log write failed:", logErr.message);
      }
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
    console.error("[email-send] error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
