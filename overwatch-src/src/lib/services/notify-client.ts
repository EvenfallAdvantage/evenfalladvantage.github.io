/**
 * Browser client for the `notify-send` Edge Function. All outbound email/SMS
 * from the app goes through the server: provider credentials stay in Vault
 * and recipient addresses are looked up server-side from user ids.
 */
import { createClient } from "@/lib/supabase/client";

export type NotifyChannel = "email" | "sms";
export interface NotifySendResult {
  ok: boolean;
  email: { sent: number; failed: number };
  sms: { sent: number; failed: number; skipped?: string };
  error?: string;
}

const EMPTY = { email: { sent: 0, failed: 0 }, sms: { sent: 0, failed: 0 } };

async function callNotifySend(payload: Record<string, unknown>): Promise<NotifySendResult> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, ...EMPTY, error: "Not signed in" };
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return { ok: false, ...EMPTY, error: "Supabase URL missing" };
  try {
    const res = await fetch(`${base.replace(/\/+$/, "")}/functions/v1/notify-send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as Partial<NotifySendResult> & { error?: string };
    if (!res.ok) return { ok: false, ...EMPTY, error: body.error ?? `HTTP ${res.status}` };
    return { ok: true, email: body.email ?? EMPTY.email, sms: body.sms ?? EMPTY.sms };
  } catch (e) {
    return { ok: false, ...EMPTY, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Email and/or SMS a notification to company members (by internal user id). */
export function notifyMembers(params: {
  companyId: string;
  userIds: string[];
  channels: NotifyChannel[];
  title: string;
  body?: string;
  /** App-relative path, e.g. "/admin/staff". */
  actionUrl?: string;
}): Promise<NotifySendResult> {
  if (!params.channels.length || !params.userIds.length) return Promise.resolve({ ok: true, ...EMPTY });
  return callNotifySend({
    company_id: params.companyId,
    kind: "notification",
    channels: params.channels,
    user_ids: params.userIds,
    title: params.title,
    body: params.body,
    action_url: params.actionUrl?.startsWith("/") ? params.actionUrl : undefined,
  });
}

/** Post-hire welcome email (server builds the content; managers+ only). */
export function sendWelcomeEmail(params: { companyId: string; toEmail: string; firstName?: string }): Promise<NotifySendResult> {
  return callNotifySend({ company_id: params.companyId, kind: "welcome", to_email: params.toEmail, first_name: params.firstName });
}
