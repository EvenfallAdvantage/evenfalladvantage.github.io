/**
 * Pure request rules for notify-send (no Deno / network imports so the
 * Overwatch vitest suite can test them).
 */

export const ROLE_RANK: Record<string, number> = {
  owner: 60, admin: 50, instructor: 45, manager: 40, lead: 30, breaker: 20, staff: 10, client: 5,
};
export const rank = (role: string | null | undefined) => ROLE_RANK[role ?? ""] ?? 0;

export const MAX_RECIPIENTS = 100;
export type Channel = "email" | "sms" | "push";

export interface NotificationRequest {
  company_id: string;
  kind: "notification";
  channels: Channel[];
  user_ids: string[];
  title: string;
  body?: string;
  action_url?: string;
  /** Send SMS only to recipients a push notification did not reach. */
  sms_fallback?: boolean;
  /** The record this is about; lets staff notify one peer about it. */
  ref?: NotifyRef;
}
export interface NotifyRef { type: "dm" | "swap" | "task"; id: string }
export interface WelcomeRequest {
  company_id: string;
  kind: "welcome";
  to_email: string;
  first_name?: string;
}
export type NotifyRequest = NotificationRequest | WelcomeRequest;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

/** Validate and normalise a request body. Returns an error string or the request. */
export function parseNotifyRequest(raw: unknown): NotifyRequest | string {
  if (!raw || typeof raw !== "object") return "Invalid body";
  const b = raw as Record<string, unknown>;
  if (typeof b.company_id !== "string" || !UUID.test(b.company_id)) return "company_id required";
  if (b.kind === "welcome") {
    if (typeof b.to_email !== "string" || !EMAIL.test(b.to_email) || b.to_email.length > 254) return "Valid to_email required";
    const first = typeof b.first_name === "string" ? b.first_name.slice(0, 60) : undefined;
    return { company_id: b.company_id, kind: "welcome", to_email: b.to_email.trim(), first_name: first };
  }
  if (b.kind !== "notification") return "kind must be notification or welcome";
  const channels = Array.isArray(b.channels) ? [...new Set(b.channels.filter((c): c is Channel => c === "email" || c === "sms" || c === "push"))] : [];
  if (!channels.length) return "channels must include email, sms and/or push";
  const ids = Array.isArray(b.user_ids) ? [...new Set(b.user_ids.filter((x): x is string => typeof x === "string" && UUID.test(x)))] : [];
  if (!ids.length) return "user_ids required";
  if (ids.length > MAX_RECIPIENTS) return `At most ${MAX_RECIPIENTS} recipients`;
  if (typeof b.title !== "string" || !b.title.trim() || b.title.length > 200) return "title required (max 200 chars)";
  if (b.body !== undefined && (typeof b.body !== "string" || b.body.length > 2000)) return "body max 2000 chars";
  let action_url: string | undefined;
  if (b.action_url !== undefined) {
    // Only same-app relative paths: no open redirects / phishing links.
    if (typeof b.action_url !== "string" || !/^\/(?!\/)[\w\-./?=&#%]*$/.test(b.action_url)) return "action_url must be an app path like /admin/staff";
    action_url = b.action_url;
  }
  const sms_fallback = b.sms_fallback === true && channels.includes("push") && !channels.includes("sms");
  let ref: NotifyRef | undefined;
  if (b.ref !== undefined) {
    const r = b.ref as Record<string, unknown> | null;
    if (!r || (r.type !== "dm" && r.type !== "swap" && r.type !== "task") || typeof r.id !== "string" || !UUID.test(r.id)) return "ref must be {type: dm|swap|task, id: uuid}";
    if (ids.length !== 1) return "ref allows a single recipient";
    ref = { type: r.type, id: r.id };
  }
  return { company_id: b.company_id, kind: "notification", channels, user_ids: ids, title: b.title.trim(), body: b.body as string | undefined, action_url, sms_fallback, ref };
}

/**
 * Who may notify whom:
 *  - welcome: manager and above (the people who hire).
 *  - notification: any member may notify managers+ (e.g. a staff time
 *    correction request to admins); notifying staff-level members needs
 *    lead or above, OR a verified `ref` (refVerified): the caller's own DM to
 *    that person, the swap they claimed from them, or a task they assigned to
 *    them. Every recipient must be a member of the same company.
 */
export function authorize(
  req: NotifyRequest,
  callerRole: string | null,
  recipientRoles: Record<string, string | undefined>,
  refVerified = false,
): string | null {
  const r = rank(callerRole);
  if (!r) return "Not a member of this company";
  if (req.kind === "welcome") return r >= ROLE_RANK.manager ? null : "Only managers and above can send welcome emails";
  for (const id of req.user_ids) {
    const role = recipientRoles[id];
    if (!role) return "Every recipient must be a member of this company";
    if (r < ROLE_RANK.lead && rank(role) < ROLE_RANK.manager && !refVerified) return "You can only notify managers and above";
  }
  return null;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function notificationEmailHtml(title: string, body: string | undefined, link: string | null): string {
  return `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="font-size:18px;">${escapeHtml(title)}</h2>
  ${body ? `<p style="font-size:14px;color:#555;white-space:pre-wrap;">${escapeHtml(body)}</p>` : ""}
  ${link ? `<p><a href="${escapeHtml(link)}" style="color:#2563eb;">View in Overwatch</a></p>` : ""}
</div>`;
}

export function smsText(title: string, body?: string): string {
  const t = body ? `${title}: ${body}` : title;
  return t.length > 480 ? `${t.slice(0, 477)}...` : t;
}

export function welcomeEmail(p: { firstName?: string; companyName: string; joinCode: string | null; appUrl: string }) {
  const hi = p.firstName ? `Hi ${escapeHtml(p.firstName)},` : "Hi,";
  const company = escapeHtml(p.companyName);
  return {
    subject: `Welcome to ${p.companyName}`,
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <p>${hi}</p>
  <p>You've been hired at <strong>${company}</strong>. Create your Overwatch account to see your schedule and get started.</p>
  ${p.joinCode ? `<p>Your company join code: <strong style="font-size:18px;letter-spacing:2px;">${escapeHtml(p.joinCode)}</strong></p>` : ""}
  <p><a href="${escapeHtml(p.appUrl)}" style="color:#2563eb;">Open Overwatch</a></p>
</div>`,
  };
}

/**
 * Who gets an SMS. "sms" channel: everyone with a phone. sms_fallback: only
 * recipients a push did not reach. Otherwise nobody.
 */
export function smsRecipientIds(
  req: Pick<NotificationRequest, "channels" | "sms_fallback">,
  recipientIds: string[],
  pushDelivered: Set<string>,
): string[] {
  if (req.channels.includes("sms")) return recipientIds;
  if (req.sms_fallback) return recipientIds.filter((id) => !pushDelivered.has(id));
  return [];
}

/** Web push payload (kept small: some push services cap at 4 KB). */
export function pushPayload(title: string, body: string | undefined, url: string | null, tag?: string) {
  return JSON.stringify({ title: title.slice(0, 120), body: (body ?? "").slice(0, 300), url: url ?? undefined, tag });
}

/** Max age of the referenced record: an alert must follow the action. */
export const REF_MAX_AGE_MS = 10 * 60_000;

/** Pure check of a looked-up ref row against caller + recipient. */
export function refMatches(
  ref: NotifyRef,
  row: Record<string, unknown> | null,
  callerId: string,
  recipientId: string,
  companyId: string,
  now = Date.now(),
): boolean {
  if (!row) return false;
  const fresh = (v: unknown) => { const t = Date.parse(String(v ?? "").replace(" ", "T") + (/[zZ]|[+-]\d\d:?\d\d$/.test(String(v ?? "")) ? "" : "Z")); return Number.isFinite(t) && now - t < REF_MAX_AGE_MS; };
  if (ref.type === "dm") return row.from_user_id === callerId && row.to_user_id === recipientId && row.company_id === companyId && fresh(row.created_at);
  if (ref.type === "swap") return row.replacement_id === callerId && row.requester_id === recipientId && row.company_id === companyId && fresh(row.updated_at);
  return row.assigned_to === recipientId && row.company_id === companyId && row.created_by === callerId && fresh(row.updated_at);
}
