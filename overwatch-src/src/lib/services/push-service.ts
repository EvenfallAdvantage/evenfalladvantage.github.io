/**
 * Push Notification Service (OneSignal)
 *
 * Sends native push notifications via OneSignal's REST API
 * using the company's stored integration config.
 */

import { getOneSignalConfig } from "./integrations";

/**
 * Send a push notification to specific user(s) via OneSignal.
 * `externalUserIds` should be the Overwatch internal user IDs
 * (OneSignal external_id must be set on the client SDK to match).
 */
export async function sendPushNotification(
  companyId: string,
  params: {
    userIds: string[];
    title: string;
    body: string;
    url?: string;
    data?: Record<string, string>;
  }
): Promise<boolean> {
  const cfg = await getOneSignalConfig(companyId);
  if (!cfg) {
    console.warn("[Push/OneSignal] No active OneSignal integration for company", companyId);
    return false;
  }

  try {
    const res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${cfg.rest_api_key}`,
      },
      body: JSON.stringify({
        app_id: cfg.app_id,
        include_aliases: { external_id: params.userIds },
        target_channel: "push",
        headings: { en: params.title },
        contents: { en: params.body },
        ...(params.url ? { url: params.url } : {}),
        ...(params.data ? { data: params.data } : {}),
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[Push/OneSignal] Send failed (${res.status}):`, err);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Push/OneSignal] Network error:", err);
    return false;
  }
}

/**
 * Send a push notification to ALL users in the OneSignal app (broadcast).
 * Use sparingly — for company-wide announcements only.
 */
export async function sendBroadcastPush(
  companyId: string,
  params: { title: string; body: string; url?: string }
): Promise<boolean> {
  const cfg = await getOneSignalConfig(companyId);
  if (!cfg) return false;

  try {
    const res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${cfg.rest_api_key}`,
      },
      body: JSON.stringify({
        app_id: cfg.app_id,
        included_segments: ["Subscribed Users"],
        headings: { en: params.title },
        contents: { en: params.body },
        ...(params.url ? { url: params.url } : {}),
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[Push/OneSignal] Broadcast failed (${res.status}):`, err);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Push/OneSignal] Network error:", err);
    return false;
  }
}
