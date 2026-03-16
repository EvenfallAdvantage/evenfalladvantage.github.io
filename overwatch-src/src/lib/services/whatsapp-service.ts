/**
 * WhatsApp Business API Service
 *
 * Sends messages and community invites via the WhatsApp Cloud API
 * using the company's stored WABA credentials.
 */

import { getWhatsAppConfig } from "./integrations";

const WA_API = "https://graph.facebook.com/v21.0";

// ─── Core Send ────────────────────────────────────────────

async function waFetch(phoneNumberId: string, accessToken: string, endpoint: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(`${WA_API}/${phoneNumberId}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[WhatsApp] API error (${res.status}):`, err);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[WhatsApp] Network error:", err);
    return false;
  }
}

// ─── Public API ───────────────────────────────────────────

/**
 * Send a plain text message to a phone number.
 * Phone must be in E.164 format (e.g. +15551234567).
 */
export async function sendWhatsAppMessage(
  companyId: string,
  to: string,
  text: string
): Promise<boolean> {
  const cfg = await getWhatsAppConfig(companyId);
  if (!cfg) {
    console.warn("[WhatsApp] No active WhatsApp integration for company", companyId);
    return false;
  }
  return waFetch(cfg.phone_number_id, cfg.access_token, "messages", {
    messaging_product: "whatsapp",
    to: to.replace(/[^0-9+]/g, ""),
    type: "text",
    text: { body: text },
  });
}

/**
 * Send a welcome message to a newly hired employee with
 * the community invite link and onboarding instructions.
 */
export async function sendWhatsAppWelcome(
  companyId: string,
  params: {
    phone: string;
    firstName: string;
    companyName: string;
    joinCode: string;
    appUrl: string;
  }
): Promise<boolean> {
  const cfg = await getWhatsAppConfig(companyId);
  if (!cfg) return false;

  const lines = [
    `Welcome to ${params.companyName}, ${params.firstName}! 🎉`,
    "",
    "You've been hired. Here's how to get started:",
    `1. Go to ${params.appUrl}/register`,
    `2. Create your account with this email`,
    `3. Use join code: ${params.joinCode}`,
    `4. Complete your onboarding checklist`,
  ];

  if (cfg.community_invite_link) {
    lines.push("", `Join our team chat: ${cfg.community_invite_link}`);
  }

  return sendWhatsAppMessage(companyId, params.phone, lines.join("\n"));
}

/**
 * Send a shift reminder via WhatsApp.
 */
export async function sendWhatsAppShiftReminder(
  companyId: string,
  params: {
    phone: string;
    firstName: string;
    shiftDate: string;
    shiftTime: string;
    location?: string;
  }
): Promise<boolean> {
  const lines = [
    `⏰ Shift Reminder`,
    `Hi ${params.firstName}, you have an upcoming shift:`,
    "",
    `📅 ${params.shiftDate}`,
    `🕐 ${params.shiftTime}`,
  ];
  if (params.location) lines.push(`📍 ${params.location}`);
  return sendWhatsAppMessage(companyId, params.phone, lines.join("\n"));
}

/**
 * Get the community invite link (if configured).
 */
export async function getWhatsAppCommunityLink(companyId: string): Promise<string | null> {
  const cfg = await getWhatsAppConfig(companyId);
  return cfg?.community_invite_link ?? null;
}
