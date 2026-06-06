/**
 * roster-invite — invite one or more roster members.
 *
 * Auth: user JWT (verify_jwt = true). Caller must be owner/admin/manager of
 * the target company_id, verified via the SQL helper public.is_company_admin.
 *
 * Body:
 *   {
 *     company_id: uuid,
 *     membership_ids: uuid[],        // 1..N. Use length 1 for the per-row button.
 *     resend?: boolean,              // true = bump resend_count, false = idempotent insert
 *   }
 *
 * For each membership:
 *   1. Load company_membership + linked users row.
 *   2. Skip if users.supabase_id is already set (already linked — no invite needed).
 *   3. If a different company_memberships row exists for this email in another
 *      company AND that user is already linked, we still generate a Supabase
 *      Auth recovery link (not invite) since the auth user already exists —
 *      they'll set/keep their password and the accept_roster_invitation RPC
 *      handles the cross-company membership attach.
 *   4. Otherwise call supabase.auth.admin.generateLink({type:'invite'}).
 *   5. Send through email-send Edge Function (purpose:"invitation").
 *   6. UPSERT roster_invitations row (idempotent via membership_id UNIQUE).
 *
 * Returns: { results: Array<{ membership_id, status, reason? }> }
 *
 * Rate limit: 100 calls / hour / caller (enforced in-process via Map).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  getCallerIp,
  getCallerUserAgent,
  logAudit,
} from "../_shared/audit.ts";
import { buildInvitationEmail } from "../_shared/email/templates.ts";

interface InviteRequest {
  company_id: string;
  membership_ids: string[];
  resend?: boolean;
}

interface PerMemberResult {
  membership_id: string;
  status: "sent" | "resent" | "skipped" | "error";
  reason?: string;
}

// In-process rate limit. Resets when the Edge Function cold-starts; acceptable
// for a per-hour 100-call ceiling.
const rateLimitWindow = 60 * 60 * 1000;
const rateLimitMax = 100;
const callerCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(callerId: string): boolean {
  const now = Date.now();
  const entry = callerCounts.get(callerId);
  if (!entry || entry.resetAt < now) {
    callerCounts.set(callerId, { count: 1, resetAt: now + rateLimitWindow });
    return true;
  }
  if (entry.count >= rateLimitMax) return false;
  entry.count++;
  return true;
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

    if (!checkRateLimit(caller.id)) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded (100/hour)" }),
        { status: 429, headers: jsonHeaders },
      );
    }

    const body = (await req.json()) as InviteRequest;
    if (
      !body.company_id ||
      !Array.isArray(body.membership_ids) ||
      body.membership_ids.length === 0
    ) {
      return new Response(
        JSON.stringify({ error: "company_id and membership_ids[] required" }),
        { status: 400, headers: jsonHeaders },
      );
    }
    if (body.membership_ids.length > 500) {
      return new Response(
        JSON.stringify({ error: "Max 500 invitations per request" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // RBAC check via is_company_admin (owner/admin/manager).
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
        event_type: "roster.invite.forbidden",
        company_id: body.company_id,
        user_id: null,
        outcome: "blocked",
        ip_address: getCallerIp(req),
        user_agent: getCallerUserAgent(req),
        metadata: { caller_supabase_id: caller.id },
      });
      return new Response(
        JSON.stringify({ error: "Forbidden — company admin required" }),
        { status: 403, headers: jsonHeaders },
      );
    }

    // Look up internal users.id for the caller (used as roster_invitations.invited_by).
    const { data: callerRow } = await admin
      .from("users")
      .select("id, first_name, last_name, email")
      .eq("supabase_id", caller.id)
      .single();
    const inviterUserId = callerRow?.id ?? null;
    const inviterName =
      [callerRow?.first_name, callerRow?.last_name].filter(Boolean).join(" ") ||
        callerRow?.email || "Your team";

    // Company name for the email subject + branding.
    const { data: company } = await admin
      .from("companies")
      .select("name")
      .eq("id", body.company_id)
      .single();
    const companyName = company?.name ?? "Overwatch";

    // Pull all memberships in one shot, with user info attached.
    const { data: memberships, error: memErr } = await admin
      .from("company_memberships")
      .select(
        "id, company_id, user_id, users:users!company_memberships_user_id_fkey(id, email, first_name, last_name, supabase_id)",
      )
      .in("id", body.membership_ids)
      .eq("company_id", body.company_id);

    if (memErr) {
      return new Response(
        JSON.stringify({ error: `Membership lookup failed: ${memErr.message}` }),
        { status: 500, headers: jsonHeaders },
      );
    }

    const siteUrl = Deno.env.get("SITE_URL") ?? "https://www.evenfalladvantage.com";
    const redirectTo = `${siteUrl}/overwatch/auth/update-password/?invite=1`;
    const results: PerMemberResult[] = [];

    for (const m of memberships ?? []) {
      // supabase-js types the embedded relation as object|array depending on
      // version; normalize.
      const u = Array.isArray(m.users) ? m.users[0] : m.users;
      if (!u || !u.email) {
        results.push({
          membership_id: m.id,
          status: "error",
          reason: "Missing email on linked user",
        });
        continue;
      }

      // If already linked, no invite needed.
      if (u.supabase_id) {
        results.push({
          membership_id: m.id,
          status: "skipped",
          reason: "User already has an account",
        });
        continue;
      }

      try {
        // Generate the Supabase auth action link. Try `invite` first: if the
        // auth.users row doesn't exist, this creates it and we get a link
        // that signs the user in + opens the update-password page. If the
        // auth row already exists (the invitee has an Overwatch account in
        // another company), `invite` will fail with "user already
        // registered" — fall back to a `recovery` link which still drops
        // them onto update-password where accept_roster_invitation() can
        // attach the new company_memberships row.
        let actionLink: string | null = null;
        let linkErrMsg: string | null = null;

        const tryInvite = await admin.auth.admin.generateLink({
          type: "invite",
          email: u.email,
          options: { redirectTo },
        });
        if (tryInvite.error) {
          const msg = tryInvite.error.message ?? "";
          if (/already.*registered|already.*exists|registered/i.test(msg)) {
            const tryRecovery = await admin.auth.admin.generateLink({
              type: "recovery",
              email: u.email,
              options: { redirectTo },
            });
            if (tryRecovery.error || !tryRecovery.data?.properties?.action_link) {
              linkErrMsg = tryRecovery.error?.message ??
                "Recovery link generation failed";
            } else {
              actionLink = tryRecovery.data.properties.action_link;
            }
          } else {
            linkErrMsg = msg;
          }
        } else if (tryInvite.data?.properties?.action_link) {
          actionLink = tryInvite.data.properties.action_link;
        }

        if (!actionLink) {
          results.push({
            membership_id: m.id,
            status: "error",
            reason: linkErrMsg ?? "No action_link returned",
          });
          continue;
        }

        const { subject, html, text } = buildInvitationEmail({
          firstName: u.first_name ?? "",
          companyName,
          inviteUrl: actionLink,
          inviterName,
          expiresInDays: 7,
        });

        // Call email-send with service-role auth.
        const emailRes = await fetch(`${supabaseUrl}/functions/v1/email-send`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            company_id: body.company_id,
            to: [{
              email: u.email,
              name: [u.first_name, u.last_name].filter(Boolean).join(" "),
            }],
            subject,
            html,
            text,
            reply_to: callerRow?.email
              ? { email: callerRow.email, name: inviterName }
              : undefined,
            purpose: "invitation",
            idempotency_key: `invite-${m.id}-${Date.now()}`,
          }),
        });
        const emailJson = await emailRes.json().catch(() => ({}));
        if (!emailRes.ok || (emailJson.rejected?.length ?? 0) > 0) {
          results.push({
            membership_id: m.id,
            status: "error",
            reason: emailJson.error ??
              emailJson.rejected?.[0]?.reason ??
              `email-send HTTP ${emailRes.status}`,
          });
          continue;
        }

        // UPSERT via the atomic SECURITY DEFINER RPC. On conflict it bumps
        // resend_count atomically; on first insert it leaves resend_count
        // at 0. The "resent" status is determined by reading the returned
        // resend_count.
        const { data: invRow, error: rpcErr } = await admin.rpc(
          "upsert_roster_invitation",
          {
            p_company_id: body.company_id,
            p_membership_id: m.id,
            p_invitee_email: u.email,
            p_invited_by: inviterUserId,
            p_metadata: {
              used_fallback: emailJson.used_fallback === true,
              delivery_method: emailJson.delivery_method,
            },
          },
        );
        if (rpcErr) {
          results.push({
            membership_id: m.id,
            status: "error",
            reason: `Log write failed: ${rpcErr.message}`,
          });
          continue;
        }

        const resendCount = (invRow as { resend_count?: number } | null)
          ?.resend_count ?? 0;
        results.push({
          membership_id: m.id,
          status: resendCount > 0 ? "resent" : "sent",
        });
      } catch (err) {
        results.push({
          membership_id: m.id,
          status: "error",
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Audit the bulk action.
    await logAudit(admin, {
      event_type: "roster.invite.sent",
      company_id: body.company_id,
      user_id: inviterUserId,
      outcome: "success",
      ip_address: getCallerIp(req),
      user_agent: getCallerUserAgent(req),
      metadata: {
        count: body.membership_ids.length,
        sent: results.filter((r) => r.status === "sent").length,
        resent: results.filter((r) => r.status === "resent").length,
        skipped: results.filter((r) => r.status === "skipped").length,
        errors: results.filter((r) => r.status === "error").length,
      },
    });

    return new Response(JSON.stringify({ results }), { headers: jsonHeaders });
  } catch (err) {
    // eslint-disable-next-line no-console -- top-level error path
    console.error("[roster-invite] error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
