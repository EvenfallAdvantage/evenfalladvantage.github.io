/**
 * SMS Service (Twilio)
 *
 * Sends SMS messages via Twilio's REST API using
 * the company's stored integration config.
 */

import { getTwilioConfig } from "./integrations";

/**
 * Send an SMS message via Twilio.
 * `to` must be E.164 format (e.g. +15551234567).
 * Returns true on success, false on failure (never throws).
 */
export async function sendSMS(
  companyId: string,
  to: string,
  body: string
): Promise<boolean> {
  const cfg = await getTwilioConfig(companyId);
  if (!cfg) {
    console.warn("[SMS/Twilio] No active Twilio integration for company", companyId);
    return false;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${cfg.account_sid}/Messages.json`;
  const params = new URLSearchParams();
  params.append("To", to.replace(/[^0-9+]/g, ""));
  params.append("Body", body);

  // Use MessagingServiceSid if available, otherwise From number
  if (cfg.messaging_service_sid) {
    params.append("MessagingServiceSid", cfg.messaging_service_sid);
  } else {
    params.append("From", cfg.from_number);
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + btoa(`${cfg.account_sid}:${cfg.auth_token}`),
      },
      body: params.toString(),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[SMS/Twilio] Send failed (${res.status}):`, err);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[SMS/Twilio] Network error:", err);
    return false;
  }
}

/**
 * Send a shift reminder SMS.
 */
export async function sendShiftReminderSMS(
  companyId: string,
  params: {
    phone: string;
    firstName: string;
    shiftDate: string;
    shiftTime: string;
    location?: string;
  }
): Promise<boolean> {
  const loc = params.location ? ` at ${params.location}` : "";
  const body = `Hi ${params.firstName}, reminder: you have a shift on ${params.shiftDate} at ${params.shiftTime}${loc}. — Overwatch`;
  return sendSMS(companyId, params.phone, body);
}

/**
 * Send an emergency/urgent alert SMS.
 */
export async function sendAlertSMS(
  companyId: string,
  phone: string,
  message: string
): Promise<boolean> {
  return sendSMS(companyId, phone, `🚨 ALERT: ${message} — Overwatch`);
}
