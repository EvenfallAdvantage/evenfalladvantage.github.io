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
 *   3. Probe auth.users for the email via listUsers({ filter }).
 *   4. If an auth user exists AND is confirmed, send the cross-company
 *      "you've been added" notification (they can sign in as-is); the
 *      accept_roster_invitation RPC attaches the new membership on sign-in.
 *   5. Otherwise (no auth user, or unconfirmed leftover from a previous
 *      invite) call supabase.auth.admin.generateLink({type:'invite'}) to
 *      issue/refresh the password-set link. If GoTrue rejects invite
 *      generation for an existing account, fall back to
 *      generateLink({type:'recovery'}) so a manager can always resend a
 *      working link instead of seeing "email already registered".
 *   6. Send through email-send Edge Function (purpose:"invitation").
 *   7. UPSERT roster_invitations row (idempotent via membership_id UNIQUE).
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
import {
  buildCrossCompanyAddEmail,
  buildInvitationEmail,
} from "../_shared/email/templates.ts";

interface InviteRequest {
  company_id: string;
  membership_ids: string[];
  resend?: boolean;
}

interface PerMemberResult {
  membership_id: string;
  /**
   * - "sent" / "resent": invitation email with password-set link delivered.
   * - "notified": user already has an Overwatch account (in another company);
   *   we sent a "you've been added" notification instead, with NO password
   *   reset link. The membership_id is marked accepted immediately.
   * - "skipped": user already linked to this exact company's membership;
   *   nothing to do (e.g. resending invite to a member who already finished
   *   accepting it).
   * - "error": something failed; see `reason`.
   */
  status: "sent" | "resent" | "notified" | "skipped" | "error";
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

      // If this company's membership is already linked to a Supabase auth
      // user, there's nothing to do — they already accepted.
      if (u.supabase_id) {
        results.push({
          membership_id: m.id,
          status: "skipped",
          reason: "User already has an account in this company",
        });
        continue;
      }

      try {
        // ── Determine which path this invitee is on ──
        // Look up auth.users by email. If a confirmed row exists, this
        // email already belongs to an Overwatch account (in a different
        // company, since the public.users.supabase_id check above proved
        // it's not linked in THIS company). We send the cross-company
        // notification email instead of a password-set link. An
        // *unconfirmed* leftover (created by an earlier invite that was
        // never accepted) should still receive a fresh invite link.
        //
        // listUsers supports an ILIKE `filter` search term (substring
        // match on email); page-1 + perPage-1 keeps this O(1). Emails
        // contain no wildcards, so a substring match against the full
        // address is effectively exact. (Passing a bogus `email` param —
        // which GoTrue ignores — is what previously made this probe a
        // coin-flip and pushed existing users into the invite path, where
        // generateLink errors with "email already registered".)
        let authUserExists = false;
        let authUserConfirmed = false;
        try {
          const { data: authList } = await admin.auth.admin.listUsers({
            page: 1,
            perPage: 1,
            filter: u.email,
          });
          const au = authList?.users?.[0];
          if (au && au.email && au.email.toLowerCase() === u.email.toLowerCase()) {
            authUserExists = true;
            authUserConfirmed = Boolean(au.confirmed_at);
          }
        } catch (_listErr) {
          // If listUsers fails, fall through and let the generateLink path
          // decide; the recovery-link fallback below catches the
          // "already registered" edge case so we never hard-fail.
          authUserExists = false;
          authUserConfirmed = false;
        }

        if (authUserExists && authUserConfirmed) {
          // ── Cross-company notification path ──
          // The user already has an Overwatch account elsewhere. Don't
          // generate a password-reset link — that would confuse them with
          // a "set your password" prompt they don't need. Send a plain
          // "you've been added" email instead.
          const signInUrl = `${siteUrl}/overwatch/login`;
          const { subject, html, text } = buildCrossCompanyAddEmail({
            firstName: u.first_name ?? "",
            companyName,
            inviterName,
            signInUrl,
          });

          const emailRes = await fetch(
            `${supabaseUrl}/functions/v1/email-send`,
            {
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
                // Reuse "invitation" purpose — same semantic event,
                // different body. (Adding a new purpose value would also
                // require an email_send_log CHECK constraint change.)
                purpose: "invitation",
                idempotency_key: `xcompany-${m.id}-${Date.now()}`,
              }),
            },
          );
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

          // Mark the invitation accepted immediately — there's nothing for
          // the user to do, the membership row already exists and they can
          // sign in to see it. Without this the row would sit in
          // "pending" forever and pollute the "Invite Unlinked" count.
          const { error: rpcErr } = await admin.rpc(
            "upsert_roster_invitation",
            {
              p_company_id: body.company_id,
              p_membership_id: m.id,
              p_invitee_email: u.email,
              p_invited_by: inviterUserId,
              p_metadata: {
                used_fallback: emailJson.used_fallback === true,
                delivery_method: emailJson.delivery_method,
                cross_company: true,
                auth_user_confirmed: true,
                resend: body.resend === true,
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
          // Stamp accepted_at so the UI shows "Active" not "Pending invite"
          // for this membership.
          await admin
            .from("roster_invitations")
            .update({ accepted_at: new Date().toISOString() })
            .eq("membership_id", m.id);

          results.push({ membership_id: m.id, status: "notified" });
          continue;
        }

        // ── Standard invite path: no confirmed auth.users row yet ──
        // generateLink({type:'invite'}) creates the auth.users row (or
        // issues a fresh invite token for an unconfirmed leftover) and
        // returns an action_link that signs the user in + opens the
        // update-password page. If an existing account blocks the invite
        // (GoTrue rejects duplicate-email invites), degrade to a
        // recovery link so the manager can resend a working link instead
        // of seeing "email already registered".
        const generateSetupLink = async (linkType: "invite" | "recovery") =>
          admin.auth.admin.generateLink({
            type: linkType,
            email: u.email,
            options: { redirectTo },
          });

        const primary = await generateSetupLink("invite");
        const needsRecovery = Boolean(
          primary.error &&
          /already (been )?registered/i.test(primary.error.message),
        );
        const { data: linkData, error: linkErr } = needsRecovery
          ? await generateSetupLink("recovery")
          : primary;

        if (linkErr || !linkData?.properties?.action_link) {
          results.push({
            membership_id: m.id,
            status: "error",
            reason: linkErr?.message ?? "No action_link returned",
          });
          continue;
        }
        const actionLink = linkData.properties.action_link;

        const { subject, html, text } = buildInvitationEmail({
          firstName: u.first_name ?? "",
          companyName,
          inviteUrl: actionLink,
          inviterName,
          expiresInDays: 7,
        });

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

        // Atomic upsert: insert fresh on first send, bump resend_count on
        // subsequent sends. The returned resend_count distinguishes the
        // two outcomes for the per-row result status.
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
              used_recovery_link: needsRecovery,
              resend: body.resend === true,
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
        notified: results.filter((r) => r.status === "notified").length,
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
