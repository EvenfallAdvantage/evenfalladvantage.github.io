/**
 * Pure request rules for notify-send (no Deno / network imports so the
 * Overwatch vitest suite can test them).
 */

export const ROLE_RANK: Record<string, number> = {
  owner: 60, admin: 50, instructor: 45, manager: 40, lead: 30, breaker: 20, staff: 10, client: 5,
};
export const rank = (role: string | null | undefined) => ROLE_RANK[role ?? ""] ?? 0;

export const MAX_RECIPIENTS = 100;
export type Channel = "email" | "sms";

export interface NotificationRequest {
  company_id: string;
  kind: "notification";
  channels: Channel[];
  user_ids: string[];
  title: string;
  body?: string;
  action_url?: string;
}
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
  const channels = Array.isArray(b.channels) ? [...new Set(b.channels.filter((c): c is Channel => c === "email" || c === "sms"))] : [];
  if (!channels.length) return "channels must include email and/or sms";
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
  return { company_id: b.company_id, kind: "notification", channels, user_ids: ids, title: b.title.trim(), body: b.body as string | undefined, action_url };
}

/**
 * Who may notify whom:
 *  - welcome: manager and above (the people who hire).
 *  - notification: any member may notify managers+ (e.g. a staff time
 *    correction request to admins); notifying staff-level members needs
 *    lead or above. Every recipient must be a member of the same company.
 */
export function authorize(
  req: NotifyRequest,
  callerRole: string | null,
  recipientRoles: Record<string, string | undefined>,
): string | null {
  const r = rank(callerRole);
  if (!r) return "Not a member of this company";
  if (req.kind === "welcome") return r >= ROLE_RANK.manager ? null : "Only managers and above can send welcome emails";
  for (const id of req.user_ids) {
    const role = recipientRoles[id];
    if (!role) return "Every recipient must be a member of this company";
    if (r < ROLE_RANK.lead && rank(role) < ROLE_RANK.manager) return "You can only notify managers and above";
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
