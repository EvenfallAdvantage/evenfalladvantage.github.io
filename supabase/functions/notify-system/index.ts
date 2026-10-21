/**
 * notify-system: delivers cron-created alerts (guard-card expiry reminders,
 * overdue patrols + escalations) by Web Push, plus email for guard cards.
 *
 * Auth: x-integrations-cron-secret only (pg_net from public.kick_notify_system(),
 * compared in the DB against Vault 'integrations_cron_secret'). verify_jwt = false.
 * Rows are claimed atomically via public.claim_system_notifications() (sets
 * delivered_at), so a double kick never double-sends. Content comes from the
 * notification rows themselves; callers can't inject recipients or text.
 * Delivery goes through the same push-send / email-send functions as notify-send,
 * and honours notification_mutes (patrol alerts are not mutable).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { isCronCall, serviceClient } from "../_shared/integrations/http.ts";
import { muteCategory, notificationEmailHtml, systemChannels, unmutedRecipientIds } from "../notify-send/rules.ts";

type Row = { id: string; user_id: string; company_id: string; title: string; body: string | null; type: string; action_url: string | null };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only" });
  const admin = serviceClient();
  if (!(await isCronCall(req, admin))) return json(401, { error: "Unauthorized" });

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const appUrl = (Deno.env.get("OVERWATCH_APP_URL") || "https://www.evenfalladvantage.com/overwatch").replace(/\/+$/, "");
  const call = (fn: string, body: unknown) => fetch(`${url}/functions/v1/${fn}`, {
    method: "POST", headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });

  const { data, error } = await admin.rpc("claim_system_notifications", { p_limit: 500 });
  if (error) { console.error("[notify-system] claim failed", error.message); return json(500, { error: "claim failed" }); }
  const rows = (data ?? []) as Row[];
  if (!rows.length) return json(200, { claimed: 0 });

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const [{ data: mrows }, { data: urows }] = await Promise.all([
    admin.from("notification_mutes").select("user_id, muted_types").in("user_id", userIds),
    admin.from("users").select("id, email").in("id", userIds),
  ]);
  const mutes = Object.fromEntries(((mrows ?? []) as { user_id: string; muted_types: string[] }[]).map((m) => [m.user_id, m.muted_types]));
  const emails = new Map(((urows ?? []) as { id: string; email: string | null }[]).map((u) => [u.id, u.email]));

  // One push/email per distinct (company, type, title, body, url) to all its recipients.
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = JSON.stringify([r.company_id, r.type, r.title, r.body, r.action_url]);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const out = { claimed: rows.length, push: { sent: 0, failed: 0 }, email: { sent: 0, failed: 0 }, muted: 0 };
  for (const g of groups.values()) {
    const first = g[0];
    const channels = systemChannels(first.type);
    const all = [...new Set(g.map((r) => r.user_id))];
    const ids = unmutedRecipientIds(all, muteCategory(first.type), mutes);
    out.muted += all.length - ids.length;
    if (!ids.length) continue;
    const link = first.action_url?.startsWith("/") ? `${appUrl}${first.action_url}` : null;
    if (channels.includes("push")) {
      for (let i = 0; i < ids.length; i += 500) {
        const res = await call("push-send", { user_ids: ids.slice(i, i + 500), title: first.title, body: first.body ?? undefined, url: link, tag: first.type });
        const pr = (await res.json().catch(() => ({}))) as { sent?: number; failed?: number };
        if (res.ok) { out.push.sent += pr.sent ?? 0; out.push.failed += pr.failed ?? 0; } else out.push.failed += ids.length;
      }
    }
    if (channels.includes("email")) {
      const to = ids.map((id) => emails.get(id)).filter((e): e is string => !!e).map((email) => ({ email }));
      for (let i = 0; i < to.length; i += 50) {
        const batch = to.slice(i, i + 50);
        // One email per recipient (no shared To: line between officers).
        for (const one of batch) {
          const res = await call("email-send", { company_id: first.company_id, to: [one], subject: first.title, html: notificationEmailHtml(first.title, first.body ?? undefined, link), purpose: "other" });
          if (res.ok) out.email.sent++; else out.email.failed++;
        }
      }
    }
  }
  console.log("[notify-system] delivered", out);
  return json(200, out);
});
