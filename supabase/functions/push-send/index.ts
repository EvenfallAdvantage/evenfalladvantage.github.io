/**
 * push-send: Web Push (VAPID) delivery to members' registered devices.
 *
 * Auth: service-role key only (called by notify-send, never by browsers).
 * VAPID keys are read at runtime from Supabase Vault via the service_role-only
 * RPC public.get_vapid_keys() (migration 20261020035113_vapid_vault). They were
 * generated inside Supabase and are never logged or returned. Optional fallback:
 * Edge Function env VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT.
 * If any is missing the function returns { skipped: "push not configured" } and
 * notify-send falls back to SMS when sms_fallback is set.
 *
 * Body: { user_ids: uuid[], title: string, body?: string, url?: string, tag?: string }
 * Returns: { sent, failed, removed, delivered_user_ids, skipped? }
 * Expired subscriptions (404/410) are deleted.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { pushPayload } from "../notify-send/rules.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Vapid = { pub?: string; priv?: string; subject?: string };
let cached: Vapid | null = null;
// deno-lint-ignore no-explicit-any
async function loadVapid(admin: any): Promise<Vapid> {
  if (cached?.pub && cached.priv && cached.subject) return cached;
  let v: Vapid = {};
  try {
    const { data } = await admin.rpc("get_vapid_keys");
    const r = (Array.isArray(data) ? data[0] : data) as { public_key?: string; private_key?: string; subject?: string } | null;
    if (r) v = { pub: r.public_key ?? undefined, priv: r.private_key ?? undefined, subject: r.subject ?? undefined };
  } catch { /* fall back to env */ }
  v = {
    pub: v.pub || Deno.env.get("VAPID_PUBLIC_KEY"),
    priv: v.priv || Deno.env.get("VAPID_PRIVATE_KEY"),
    subject: v.subject || Deno.env.get("VAPID_SUBJECT"),
  };
  if (v.pub && v.priv && v.subject) cached = v;
  return v;
}

Deno.serve(async (req) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!serviceKey || req.headers.get("authorization") !== `Bearer ${serviceKey}`) return json(403, { error: "Forbidden - service-role auth required" });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { pub, priv, subject } = await loadVapid(admin);
  const empty = { sent: 0, failed: 0, removed: 0, delivered_user_ids: [] as string[] };
  if (!pub || !priv || !subject) return json(200, { ...empty, skipped: "push not configured" });

  const b = (await req.json().catch(() => null)) as { user_ids?: unknown; title?: unknown; body?: unknown; url?: unknown; tag?: unknown } | null;
  const ids = Array.isArray(b?.user_ids) ? [...new Set((b!.user_ids as unknown[]).filter((x): x is string => typeof x === "string" && UUID.test(x)))].slice(0, 500) : [];
  if (!ids.length || typeof b?.title !== "string" || !b.title.trim()) return json(400, { error: "user_ids and title required" });
  const url = typeof b.url === "string" && /^https:\/\//.test(b.url) ? b.url : null;

  webpush.setVapidDetails(subject, pub, priv);
  const { data: subs, error } = await admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", ids);
  if (error) return json(500, { error: "lookup failed" });

  const payload = pushPayload(b.title, typeof b.body === "string" ? b.body : undefined, url, typeof b.tag === "string" ? b.tag.slice(0, 64) : undefined);
  const delivered = new Set<string>();
  const dead: string[] = [];
  let sent = 0, failed = 0;
  await Promise.all(((subs ?? []) as { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }[]).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 600, urgency: "high" });
      sent++; delivered.add(s.user_id);
    } catch (e) {
      failed++;
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) dead.push(s.id);
    }
  }));
  if (dead.length) await admin.from("push_subscriptions").delete().in("id", dead);
  if (delivered.size) await admin.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).in("user_id", [...delivered]);
  return json(200, { sent, failed, removed: dead.length, delivered_user_ids: [...delivered] });
});
