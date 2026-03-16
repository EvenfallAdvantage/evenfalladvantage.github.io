/**
 * Notification Dispatcher
 *
 * Wraps the DB-only createNotification() with external delivery channels:
 *  - In-app (Supabase `notifications` table) — always
 *  - OneSignal push notification — if active
 *  - Twilio SMS — if active and user has phone on file
 *  - Email — if active and notification is high-priority
 *
 * Use `dispatch()` instead of calling `createNotification()` directly
 * to ensure all configured channels fire.
 */

import { createNotification } from "@/lib/supabase/db";
import { sendPushNotification } from "./push-service";
import { sendSMS } from "./sms-service";
import { sendEmail } from "./email-service";
import { isIntegrationActive } from "./integrations";

export interface DispatchParams {
  userId: string;
  companyId: string;
  title: string;
  body?: string;
  type: string;
  actionUrl?: string;
  /** If true, also send via SMS (if Twilio is active and phone is available) */
  urgent?: boolean;
  /** If true, also send via email */
  emailFallback?: boolean;
  /** User's phone number (E.164 format) for SMS delivery */
  phone?: string;
  /** User's email for email delivery */
  email?: string;
}

export interface DispatchResult {
  inApp: boolean;
  push: boolean;
  sms: boolean;
  email: boolean;
}

/**
 * Dispatch a notification across all active channels.
 * Always creates the in-app notification; external channels are best-effort.
 */
export async function dispatch(params: DispatchParams): Promise<DispatchResult> {
  const result: DispatchResult = { inApp: false, push: false, sms: false, email: false };

  // ─── 1. In-App (always) ──────────────────────────────
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
    console.error("[Dispatch/InApp] Failed:", err);
  }

  // ─── 2. Push (OneSignal) ─────────────────────────────
  try {
    if (await isIntegrationActive(params.companyId, "onesignal")) {
      result.push = await sendPushNotification(params.companyId, {
        userIds: [params.userId],
        title: params.title,
        body: params.body ?? "",
        url: params.actionUrl,
      });
    }
  } catch (err) {
    console.error("[Dispatch/Push] Failed:", err);
  }

  // ─── 3. SMS (Twilio) — only for urgent ──────────────
  if (params.urgent && params.phone) {
    try {
      if (await isIntegrationActive(params.companyId, "twilio")) {
        const smsBody = params.body ? `${params.title}: ${params.body}` : params.title;
        result.sms = await sendSMS(params.companyId, params.phone, smsBody);
      }
    } catch (err) {
      console.error("[Dispatch/SMS] Failed:", err);
    }
  }

  // ─── 4. Email — only if requested ───────────────────
  if (params.emailFallback && params.email) {
    try {
      if (await isIntegrationActive(params.companyId, "email")) {
        result.email = await sendEmail(params.companyId, {
          to: params.email,
          subject: params.title,
          html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
            <h2 style="font-size:18px;">${params.title}</h2>
            ${params.body ? `<p style="font-size:14px;color:#555;">${params.body}</p>` : ""}
            ${params.actionUrl ? `<p><a href="${params.actionUrl}" style="color:#2563eb;">View in Overwatch</a></p>` : ""}
          </div>`,
        });
      }
    } catch (err) {
      console.error("[Dispatch/Email] Failed:", err);
    }
  }

  return result;
}

/**
 * Dispatch a notification to multiple users at once.
 * Push is batched; in-app/SMS/email are per-user.
 */
export async function dispatchToMany(
  companyId: string,
  users: { userId: string; phone?: string; email?: string }[],
  params: {
    title: string;
    body?: string;
    type: string;
    actionUrl?: string;
    urgent?: boolean;
    emailFallback?: boolean;
  }
): Promise<{ total: number; results: DispatchResult[] }> {
  const results = await Promise.all(
    users.map(u => dispatch({
      ...params,
      userId: u.userId,
      companyId,
      phone: u.phone,
      email: u.email,
    }))
  );
  return { total: users.length, results };
}
