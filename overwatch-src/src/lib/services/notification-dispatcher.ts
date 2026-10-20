/**
 * Notification Dispatcher
 *
 *  - In-app (Supabase `notifications` table): always
 *  - Email (emailFallback) and SMS (urgent): through the `notify-send`
 *    Edge Function, which looks up the member's address/phone server-side,
 *    uses the company's email/SMS config (HQ Config → Email / SMS) and logs
 *    each send. SMS is skipped unless the company has its own SMS set up.
 *  - Web push (VAPID): every dispatch, to devices the member enabled under
 *    Notifications → Phone alerts. Delivered by notify-send → push-send.
 *  - SMS: `urgent` = only members a push did not reach (SMS fallback);
 *    `critical` (SOS) = SMS always, in addition to push.
 */

import { createNotification } from "@/lib/supabase/db";
import { logger } from "@/lib/logger";
import { notifyMembers, type NotifyChannel } from "./notify-client";

export interface DispatchParams {
  userId: string;
  companyId: string;
  title: string;
  body?: string;
  type: string;
  actionUrl?: string;
  /** Also send an SMS (if the company has SMS set up and the member has a phone). */
  urgent?: boolean;
  /** Push AND SMS regardless of push delivery (SOS / life safety). */
  critical?: boolean;
  /** Also send an email. */
  emailFallback?: boolean;
  /** @deprecated Ignored. The server looks up the member's phone. */
  phone?: string;
  /** @deprecated Ignored. The server looks up the member's email. */
  email?: string;
}

export interface DispatchResult {
  inApp: boolean;
  push: boolean;
  sms: boolean;
  email: boolean;
}

/** Channels + SMS mode for notify-send (exported for tests). */
export function channelsFor(p: { urgent?: boolean; critical?: boolean; emailFallback?: boolean }): { channels: NotifyChannel[]; smsFallback: boolean } {
  const channels: NotifyChannel[] = ["push"];
  if (p.emailFallback) channels.push("email");
  if (p.critical) channels.push("sms");
  return { channels, smsFallback: !!p.urgent && !p.critical };
}

export async function dispatch(params: DispatchParams, remote = true): Promise<DispatchResult> {
  const result: DispatchResult = { inApp: false, push: false, sms: false, email: false };
  try {
    await createNotification({
      userId: params.userId,
      companyId: params.companyId,
      title: params.title,
      body: params.body,
      type: params.type,
      actionUrl: params.actionUrl,
    });
    result.inApp = true;
  } catch (err) {
    logger.swallow("dispatch:in-app", err, "warn");
  }

  if (remote) {
    const { channels, smsFallback } = channelsFor(params);
    const r = await notifyMembers({ companyId: params.companyId, userIds: [params.userId], channels, smsFallback, title: params.title, body: params.body, actionUrl: params.actionUrl });
    result.push = r.push.sent > 0;
    if (!r.ok) logger.swallow("dispatch:notify-send", new Error(r.error ?? "notify-send failed"), "warn");
    result.email = r.email.sent > 0;
    result.sms = r.sms.sent > 0;
  }
  return result;
}

/**
 * Dispatch to many users: in-app per user, then ONE server call for
 * email/SMS (batched, at most 100 per call).
 */
export async function dispatchToMany(
  companyId: string,
  users: { userId: string; phone?: string; email?: string }[],
  params: { title: string; body?: string; type: string; actionUrl?: string; urgent?: boolean; critical?: boolean; emailFallback?: boolean },
): Promise<{ total: number; results: DispatchResult[] }> {
  const results = await Promise.all(users.map((u) =>
    dispatch({ ...params, userId: u.userId, companyId }, false)));
  const { channels, smsFallback } = channelsFor(params);
  for (let i = 0; i < users.length; i += 100) {
    const batch = users.slice(i, i + 100);
    const r = await notifyMembers({ companyId, userIds: batch.map((u) => u.userId), channels, smsFallback, title: params.title, body: params.body, actionUrl: params.actionUrl });
    if (!r.ok) logger.swallow("dispatch-many:notify-send", new Error(r.error ?? "notify-send failed"), "warn");
    batch.forEach((_, j) => { results[i + j].push = r.push.sent > 0; results[i + j].email = r.email.sent > 0; results[i + j].sms = r.sms.sent > 0; });
  }
  return { total: users.length, results };
}
