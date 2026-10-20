/**
 * Browser side of web push (VAPID). The PUBLIC key comes from the build-time
 * env NEXT_PUBLIC_VAPID_PUBLIC_KEY (repo variable). The private key lives
 * only in Supabase Edge Function secrets (push-send).
 */
import { createClient } from "@/lib/supabase/client";
import { ensureInternalUser } from "@/lib/supabase/db-helpers";

export type PushState = "unsupported" | "not-configured" | "needs-install" | "denied" | "off" | "on";

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/** base64url → Uint8Array (applicationServerKey). Exported for tests. */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** iOS only allows push for PWAs added to the Home Screen. */
export function isIosNotInstalled(ua: string, standalone: boolean): boolean {
  return /iPhone|iPad|iPod/.test(ua) && !standalone;
}

export function pushSupport(env: { hasSW: boolean; hasPush: boolean; hasNotification: boolean; key: string; ua: string; standalone: boolean; permission: string | null }): PushState | null {
  if (!env.key) return "not-configured";
  if (isIosNotInstalled(env.ua, env.standalone)) return "needs-install";
  if (!env.hasSW || !env.hasPush || !env.hasNotification) return "unsupported";
  if (env.permission === "denied") return "denied";
  return null; // supported; on/off depends on the current subscription
}

function env() {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  return {
    hasSW: !!nav && "serviceWorker" in nav,
    hasPush: typeof window !== "undefined" && "PushManager" in window,
    hasNotification: typeof Notification !== "undefined",
    key: VAPID_PUBLIC_KEY,
    ua: nav?.userAgent ?? "",
    standalone: typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (nav as unknown as { standalone?: boolean })?.standalone === true),
    permission: typeof Notification !== "undefined" ? Notification.permission : null,
  };
}

export async function getPushState(): Promise<PushState> {
  const pre = pushSupport(env());
  if (pre) return pre;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}

export async function enablePush(companyId: string | null): Promise<PushState> {
  const pre = pushSupport(env());
  if (pre) return pre;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "off";
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource }));
  const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const userId = await ensureInternalUser();
  if (!userId || !j.endpoint || !j.keys?.p256dh || !j.keys.auth) throw new Error("Subscription incomplete");
  const { error } = await createClient().from("push_subscriptions").upsert(
    { user_id: userId, company_id: companyId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 300) },
    { onConflict: "endpoint" },
  );
  if (error) { await sub.unsubscribe().catch(() => {}); throw new Error(error.message); }
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await createClient().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
  return "off";
}

/** Local-only test: shows a notification through the SW without any server send. */
export async function showLocalTestNotification(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification("Overwatch test alert", { body: "Phone alerts are working on this device.", tag: "overwatch-test", icon: "/overwatch/images/icon-192.png" });
}
