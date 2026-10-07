/**
 * notify-send: user-callable email/SMS delivery for in-app notifications
 * and the post-hire welcome email. Replaces the browser-side email/SMS
 * services, which called vendor APIs from the client with plaintext keys
 * (and never worked: no CORS, and email config is stored in Vault).
 *
 * Auth: user JWT (verify_jwt = true). The caller's role in the company is
 * checked server-side; recipient addresses and phone numbers are looked up
 * server-side from user ids. The client never chooses arbitrary addresses
 * (except the single welcome recipient, managers+ only, server-built body).
 *
 * Delivery goes through email-send / sms-send (service-role), so the
 * per-company provider, platform fallback and send logs stay in one place.
 * SMS is only sent when the company has its own active `sms` config, so
 * notifications never spend on the platform Twilio account.
 *
 * Body: see rules.ts (NotificationRequest | WelcomeRequest).
 * Returns: { email: {sent, failed}, sms: {sent, failed, skipped?} }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { logAudit } from "../_shared/audit.ts";
import { authorize, notificationEmailHtml, parseNotifyRequest, smsText, welcomeEmail } from "./rules.ts";

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Missing bearer token" });

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json(401, { error: "Unauthorized" });

    const parsed = parseNotifyRequest(await req.json().catch(() => null));
    if (typeof parsed === "string") return json(400, { error: parsed });

    // Caller: auth uid -> internal users.id -> membership role.
    const { data: me } = await admin.from("users").select("id").eq("supabase_id", user.id).maybeSingle();
    const myId = (me as { id?: string } | null)?.id;
    const { data: myMem } = myId
      ? await admin.from("company_memberships").select("role").eq("company_id", parsed.company_id).eq("user_id", myId).maybeSingle()
      : { data: null };
    const callerRole = (myMem as { role?: string } | null)?.role ?? null;

    // Recipients (notification only): must be members of this company.
    let recipients: { id: string; email: string | null; phone: string | null; role: string }[] = [];
    if (parsed.kind === "notification") {
      const { data: mems } = await admin
        .from("company_memberships")
        .select("role, users!inner(id, email, phone)")
        .eq("company_id", parsed.company_id)
        .in("user_id", parsed.user_ids);
      // deno-lint-ignore no-explicit-any
      recipients = ((mems ?? []) as any[]).map((m) => ({ id: m.users.id, email: m.users.email ?? null, phone: m.users.phone ?? null, role: m.role }));
    }
    const roles = Object.fromEntries(recipients.map((r) => [r.id, r.role]));
    const denied = authorize(parsed, callerRole, roles);
    if (denied) {
      await logAudit(admin, { event_type: "notify.send", user_id: myId ?? null, company_id: parsed.company_id, outcome: "blocked", metadata: { reason: denied, kind: parsed.kind } });
      return json(403, { error: denied });
    }

    const appUrl = (Deno.env.get("OVERWATCH_APP_URL") ?? Deno.env.get("SITE_URL") ?? "").replace(/\/+$/, "");
    const call = (fn: string, body: unknown) =>
      fetch(`${url}/functions/v1/${fn}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

    const result = { email: { sent: 0, failed: 0 }, sms: { sent: 0, failed: 0, skipped: undefined as string | undefined } };

    if (parsed.kind === "welcome") {
      const { data: co } = await admin.from("companies").select("name, join_code").eq("id", parsed.company_id).maybeSingle();
      const c = co as { name?: string; join_code?: string | null } | null;
      const msg = welcomeEmail({ firstName: parsed.first_name, companyName: c?.name ?? "your new company", joinCode: c?.join_code ?? null, appUrl: appUrl || "https://overwatch.evenfalladvantage.com" });
      const res = await call("email-send", { company_id: parsed.company_id, to: [{ email: parsed.to_email }], subject: msg.subject, html: msg.html, purpose: "welcome" });
      if (res.ok) result.email.sent = 1; else result.email.failed = 1;
    } else {
      const link = parsed.action_url && appUrl ? `${appUrl}${parsed.action_url}` : null;
      if (parsed.channels.includes("email")) {
        const to = recipients.filter((r) => r.email).map((r) => ({ email: r.email as string }));
        if (to.length) {
          const res = await call("email-send", { company_id: parsed.company_id, to, subject: parsed.title, html: notificationEmailHtml(parsed.title, parsed.body, link), purpose: "other" });
          if (res.ok) result.email.sent = to.length; else result.email.failed = to.length;
        }
      }
      if (parsed.channels.includes("sms")) {
        const { data: smsCfg } = await admin.from("integrations_config").select("is_active").eq("company_id", parsed.company_id).eq("provider", "sms").maybeSingle();
        if (!(smsCfg as { is_active?: boolean } | null)?.is_active) {
          result.sms.skipped = "Company SMS is not set up";
        } else {
          const text = smsText(parsed.title, parsed.body);
          for (const r of recipients) {
            if (!r.phone || !/^\+\d{6,15}$/.test(r.phone)) continue;
            const res = await call("sms-send", { company_id: parsed.company_id, to: r.phone, body: text, purpose: "other" });
            if (res.ok) result.sms.sent++; else result.sms.failed++;
          }
        }
      }
    }

    await logAudit(admin, { event_type: "notify.send", user_id: myId ?? null, company_id: parsed.company_id, outcome: "success", metadata: { kind: parsed.kind, ...result } });
    return json(200, result);
  } catch (err) {
    console.error("[notify-send] error:", err);
    return json(500, { error: "Send failed" });
  }
});
