/**
 * roster-bulk-email — send a one-off broadcast to all (or a filtered subset
 * of) roster members for a given company.
 *
 * Auth: user JWT (verify_jwt = true). Caller must be owner/admin/manager.
 *
 * Body:
 *   {
 *     company_id: uuid,
 *     subject: string,
 *     body_html: string,           // pre-sanitized by client (allowlist)
 *     body_text: string,
 *     recipient_filter?: {
 *       roles?: string[];          // limit to these company_memberships.role values
 *       status?: string[];         // active/inactive
 *       only_linked?: boolean;     // skip unlinked roster (no auth account yet)
 *       membership_ids?: string[]; // explicit recipient list (overrides filters)
 *     },
 *     also_notify_in_app?: boolean,  // default true — fire in-app notification fan-out
 *   }
 *
 * Rate limit: 1 broadcast / 5 minutes / company.
 * Send throttle: 5 messages/sec to whichever provider is configured.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  getCallerIp,
  getCallerUserAgent,
  logAudit,
} from "../_shared/audit.ts";
import { buildBroadcastEmail } from "../_shared/email/templates.ts";

interface BulkEmailRequest {
  company_id: string;
  subject: string;
  body_html: string;
  body_text: string;
  recipient_filter?: {
    roles?: string[];
    status?: string[];
    only_linked?: boolean;
    membership_ids?: string[];
  };
  also_notify_in_app?: boolean;
}

// 1 broadcast per 5 min per company, in-process. Persistent rate-limiting
// would need a DB table; this is a soft guard against accidental double-send.
const companyLastBroadcastAt = new Map<string, number>();
const BROADCAST_COOLDOWN_MS = 5 * 60 * 1000;

const SEND_RATE_PER_SEC = 5;

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

    const body = (await req.json()) as BulkEmailRequest;
    if (
      !body.company_id || !body.subject ||
      !body.body_html || !body.body_text
    ) {
      return new Response(
        JSON.stringify({
          error: "company_id, subject, body_html, body_text required",
        }),
        { status: 400, headers: jsonHeaders },
      );
    }
    if (body.subject.length > 200 || body.body_html.length > 100_000) {
      return new Response(
        JSON.stringify({
          error: "Subject ≤ 200 chars and body ≤ 100kB",
        }),
        { status: 413, headers: jsonHeaders },
      );
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // RBAC check.
    const { data: isAdmin, error: rbacErr } = await callerClient.rpc(
      "is_company_admin",
      { comp_id: body.company_id },
    );
    if (rbacErr) {
      return new Response(
        JSON.stringify({ error: `RBAC check failed: ${rbacErr.message}` }),
        { status: 500, headers: jsonHeaders },
      );
    }
    if (!isAdmin) {
      await logAudit(admin, {
        event_type: "roster.bulk_email.forbidden",
        company_id: body.company_id,
        user_id: null,
        outcome: "blocked",
        ip_address: getCallerIp(req),
        user_agent: getCallerUserAgent(req),
      });
      return new Response(
        JSON.stringify({ error: "Forbidden — company admin required" }),
        { status: 403, headers: jsonHeaders },
      );
    }

    // Per-company cooldown.
    const now = Date.now();
    const last = companyLastBroadcastAt.get(body.company_id) ?? 0;
    if (now - last < BROADCAST_COOLDOWN_MS) {
      const remainingSec = Math.ceil(
        (BROADCAST_COOLDOWN_MS - (now - last)) / 1000,
      );
      return new Response(
        JSON.stringify({
          error: `Broadcast cooldown — try again in ${remainingSec}s`,
        }),
        { status: 429, headers: jsonHeaders },
      );
    }

    // Resolve sender identity + company name.
    const { data: callerRow } = await admin
      .from("users")
      .select("id, first_name, last_name, email")
      .eq("supabase_id", caller.id)
      .single();
    const senderName =
      [callerRow?.first_name, callerRow?.last_name].filter(Boolean).join(" ") ||
        callerRow?.email || "Your team";
    const senderEmail = callerRow?.email;

    const { data: company } = await admin
      .from("companies")
      .select("name")
      .eq("id", body.company_id)
      .single();
    const companyName = company?.name ?? "Overwatch";

    // Build recipient list.
    const filter = body.recipient_filter ?? {};
    let recipientQuery = admin
      .from("company_memberships")
      .select(
        "id, role, status, user_id, users:users!company_memberships_user_id_fkey(id, email, first_name, last_name, supabase_id)",
      )
      .eq("company_id", body.company_id);

    if (filter.membership_ids && filter.membership_ids.length > 0) {
      recipientQuery = recipientQuery.in("id", filter.membership_ids);
    } else {
      if (filter.roles && filter.roles.length > 0) {
        recipientQuery = recipientQuery.in("role", filter.roles);
      }
      const statusFilter = filter.status ?? ["active"];
      if (statusFilter.length > 0) {
        recipientQuery = recipientQuery.in("status", statusFilter);
      }
    }

    const { data: rows, error: rowErr } = await recipientQuery;
    if (rowErr) {
      return new Response(
        JSON.stringify({ error: `Roster query failed: ${rowErr.message}` }),
        { status: 500, headers: jsonHeaders },
      );
    }

    const recipients: Array<{
      membership_id: string;
      user_id: string;
      email: string;
      name: string;
      is_linked: boolean;
    }> = [];
    for (const r of rows ?? []) {
      const u = Array.isArray(r.users) ? r.users[0] : r.users;
      if (!u?.email) continue;
      if (filter.only_linked && !u.supabase_id) continue;
      recipients.push({
        membership_id: r.id,
        user_id: u.id,
        email: u.email,
        name: [u.first_name, u.last_name].filter(Boolean).join(" "),
        is_linked: Boolean(u.supabase_id),
      });
    }

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "No matching recipients" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    companyLastBroadcastAt.set(body.company_id, now);

    // Render the chrome around the manager-supplied body.
    const { html, text } = buildBroadcastEmail({
      companyName,
      senderName,
      subject: body.subject,
      bodyHtml: body.body_html,
      bodyText: body.body_text,
    });

    // Send in a throttled loop. 5 req/s ⇒ 200 ms between sends.
    const sleep = (ms: number) =>
      new Promise((res) => setTimeout(res, ms));
    let sent = 0;
    let failed = 0;
    const errors: Array<{ to: string; reason: string }> = [];

    for (const r of recipients) {
      try {
        const emailRes = await fetch(`${supabaseUrl}/functions/v1/email-send`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            company_id: body.company_id,
            to: [{ email: r.email, name: r.name }],
            subject: body.subject,
            html,
            text,
            reply_to: senderEmail
              ? { email: senderEmail, name: senderName }
              : undefined,
            purpose: "broadcast",
          }),
        });
        const j = await emailRes.json().catch(() => ({}));
        if (!emailRes.ok || (j.rejected?.length ?? 0) > 0) {
          failed++;
          errors.push({
            to: r.email,
            reason: j.error ?? j.rejected?.[0]?.reason ??
              `HTTP ${emailRes.status}`,
          });
        } else {
          sent++;
        }
      } catch (err) {
        failed++;
        errors.push({
          to: r.email,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
      await sleep(1000 / SEND_RATE_PER_SEC);
    }

    // Optional in-app notification fan-out for linked users.
    const fanOutInApp = body.also_notify_in_app !== false;
    if (fanOutInApp) {
      const linkedUserIds = recipients.filter((r) => r.is_linked).map((r) =>
        r.user_id
      );
      if (linkedUserIds.length > 0) {
        const notifRows = linkedUserIds.map((uid) => ({
          user_id: uid,
          company_id: body.company_id,
          type: "broadcast",
          title: body.subject,
          body: body.body_text.slice(0, 500),
        }));
        const { error: notifErr } = await admin
          .from("notifications")
          .insert(notifRows);
        if (notifErr) {
          // eslint-disable-next-line no-console -- best-effort fan-out
          console.warn(
            "[roster-bulk-email] in-app fan-out failed:",
            notifErr.message,
          );
        }
      }
    }

    await logAudit(admin, {
      event_type: "admin.email.sent_bulk",
      company_id: body.company_id,
      user_id: callerRow?.id ?? null,
      outcome: failed === 0 ? "success" : "failure",
      ip_address: getCallerIp(req),
      user_agent: getCallerUserAgent(req),
      metadata: {
        subject: body.subject,
        recipient_count: recipients.length,
        sent,
        failed,
      },
    });

    return new Response(
      JSON.stringify({
        recipient_count: recipients.length,
        sent,
        failed,
        errors: errors.slice(0, 20),
      }),
      { headers: jsonHeaders },
    );
  } catch (err) {
    // eslint-disable-next-line no-console -- top-level error path
    console.error("[roster-bulk-email] error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
