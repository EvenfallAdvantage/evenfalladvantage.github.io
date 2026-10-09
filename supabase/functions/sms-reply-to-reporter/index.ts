/**
 * sms-reply-to-reporter — manager replies via SMS to a public report
 * submission's reporter_phone.
 *
 * Auth: user JWT. RBAC: the caller must be manager/instructor/admin/owner
 * of the submission's company (checked via the internal users.id).
 *
 * Body:
 *   {
 *     submission_id: uuid,
 *     body: string,
 *   }
 *
 * Side effects:
 *   - Invokes sms-send (service-role) to deliver the message via the
 *     company's configured Twilio account (or platform fallback).
 *   - Writes a `public_report_messages` row (outbound / channel=sms) so the
 *     reply appears in the reporter thread UI.
 *
 * Rate limiting: 10 messages per submission per 5 minutes per user (basic
 * abuse guard; tightens as we deploy).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { logAudit } from "../_shared/audit.ts";

interface ReplyRequest {
  submission_id: string;
  body: string;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const jsonHeaders = { ...cors, "Content-Type": "application/json" };

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing bearer token" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );

    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const body = (await req.json()) as ReplyRequest;
    if (!body.submission_id || !body.body || body.body.length > 1600) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid fields" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    // Load submission with company_id; RLS allows members to read.
    const { data: submission, error: subErr } = await supabaseUser
      .from("public_report_submissions")
      .select("id, company_id, reporter_phone")
      .eq("id", body.submission_id)
      .maybeSingle();

    if (subErr || !submission) {
      return new Response(JSON.stringify({ error: "Submission not found" }), {
        status: 404,
        headers: jsonHeaders,
      });
    }

    if (!submission.reporter_phone) {
      return new Response(
        JSON.stringify({ error: "Reporter did not leave a phone number" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    // RBAC: company_memberships.user_id is the INTERNAL users.id, not the
    // auth uid, so map first (the previous check compared against the auth
    // uid and therefore rejected everyone). Managers and above only.
    const { data: meRow } = await supabaseService
      .from("users")
      .select("id")
      .eq("supabase_id", user.id)
      .maybeSingle();
    const myId = (meRow as { id?: string } | null)?.id ?? null;
    const { data: memberRow, error: memErr } = myId
      ? await supabaseService
        .from("company_memberships")
        .select("role")
        .eq("company_id", submission.company_id)
        .eq("user_id", myId)
        .maybeSingle()
      : { data: null, error: null };
    const RANK: Record<string, number> = { owner: 60, admin: 50, instructor: 45, manager: 40 };
    const memberCheck = (RANK[(memberRow as { role?: string } | null)?.role ?? ""] ?? 0) >= 40 ? memberRow : null;

    if (memErr || !memberCheck) {
      await logAudit(supabaseService, {
        event_type: "admin.sms.sent",
        user_id: myId,
        company_id: submission.company_id,
        outcome: "blocked",
        entity_type: "public_report_submission",
        entity_id: submission.id,
        metadata: { reason: "rbac_failed" },
      });
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    // Basic rate limit: count outbound SMS to this submission from this user
    // in the last 5 minutes.
    const since = new Date(Date.now() - 5 * 60_000).toISOString();
    const { count: recentCount } = await supabaseService
      .from("public_report_messages")
      .select("id", { count: "exact", head: true })
      .eq("submission_id", submission.id)
      .eq("sent_by", myId ?? "")
      .eq("channel", "sms")
      .gte("created_at", since);
    if ((recentCount ?? 0) >= 10) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded (10 per 5 minutes)" }),
        { status: 429, headers: jsonHeaders },
      );
    }

    // Dispatch via sms-send (service-role).
    const smsSendUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/sms-send`;
    const dispatch = await fetch(smsSendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        company_id: submission.company_id,
        to: submission.reporter_phone,
        body: body.body,
        purpose: "reporter_reply",
        submission_id: submission.id,
      }),
    });
    const dispatchResult = (await dispatch.json()) as Record<string, unknown>;
    if (!dispatch.ok) {
      await logAudit(supabaseService, {
        event_type: "admin.sms.sent",
        user_id: myId,
        company_id: submission.company_id,
        outcome: "failure",
        entity_type: "public_report_submission",
        entity_id: submission.id,
        metadata: { error: dispatchResult.error },
      });
      return new Response(
        JSON.stringify({ error: dispatchResult.error ?? "Send failed" }),
        { status: 502, headers: jsonHeaders },
      );
    }

    // Append thread message row.
    const { error: msgErr } = await supabaseService
      .from("public_report_messages")
      .insert({
        submission_id: submission.id,
        company_id: submission.company_id,
        direction: "outbound",
        channel: "sms",
        body: body.body,
        sent_by: myId,
        external_id: (dispatchResult.provider_id as string) ?? null,
      });
    if (msgErr) {
      // eslint-disable-next-line no-console
      console.warn("[sms-reply-to-reporter] thread insert failed:", msgErr.message);
    }

    await logAudit(supabaseService, {
      event_type: "admin.sms.sent",
      user_id: myId,
      company_id: submission.company_id,
      outcome: "success",
      entity_type: "public_report_submission",
      entity_id: submission.id,
      metadata: {
        delivery_method: dispatchResult.delivery_method,
        used_fallback: dispatchResult.used_fallback,
      },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        delivery_method: dispatchResult.delivery_method,
        used_fallback: dispatchResult.used_fallback,
        provider_id: dispatchResult.provider_id,
      }),
      { headers: jsonHeaders },
    );
  } catch (err) {
    // eslint-disable-next-line no-console -- top-level
    console.error("[sms-reply-to-reporter] error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
