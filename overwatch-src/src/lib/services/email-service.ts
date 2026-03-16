/**
 * Email Integration Service
 *
 * Sends transactional emails via Postmark or Resend based on
 * the company's stored integration config.
 */

import { getEmailConfig, type EmailConfig } from "./integrations";

// ─── Postmark API ─────────────────────────────────────────

async function sendViaPostmark(cfg: EmailConfig, params: EmailParams): Promise<boolean> {
  try {
    const res = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": cfg.api_key,
      },
      body: JSON.stringify({
        From: cfg.from_name ? `${cfg.from_name} <${cfg.from_email}>` : cfg.from_email,
        To: params.to,
        Subject: params.subject,
        HtmlBody: params.html,
        TextBody: params.text ?? stripHtml(params.html),
        MessageStream: "outbound",
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[Email/Postmark] Send failed:", res.status, err);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Email/Postmark] Network error:", err);
    return false;
  }
}

// ─── Resend API ───────────────────────────────────────────

async function sendViaResend(cfg: EmailConfig, params: EmailParams): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${cfg.api_key}`,
      },
      body: JSON.stringify({
        from: cfg.from_name ? `${cfg.from_name} <${cfg.from_email}>` : cfg.from_email,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text ?? stripHtml(params.html),
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[Email/Resend] Send failed:", res.status, err);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Email/Resend] Network error:", err);
    return false;
  }
}

// ─── Public API ───────────────────────────────────────────

export interface EmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email using the company's configured provider.
 * Returns true on success, false on failure (never throws).
 */
export async function sendEmail(companyId: string, params: EmailParams): Promise<boolean> {
  const cfg = await getEmailConfig(companyId);
  if (!cfg) {
    console.warn("[Email] No active email integration for company", companyId);
    return false;
  }
  if (cfg.provider === "postmark") return sendViaPostmark(cfg, params);
  if (cfg.provider === "resend") return sendViaResend(cfg, params);
  console.warn("[Email] Unknown provider:", cfg.provider);
  return false;
}

// ─── Email Templates ──────────────────────────────────────

export function buildWelcomeEmail(params: {
  firstName: string;
  companyName: string;
  joinCode: string;
  appUrl: string;
  communityLink?: string;
}): EmailParams {
  const { firstName, companyName, joinCode, appUrl, communityLink } = params;
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a1a;">
      <h1 style="font-size:22px;margin-bottom:4px;">Welcome to ${companyName}!</h1>
      <p style="color:#666;font-size:14px;">You've been hired — here's how to get started.</p>
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
      <p style="font-size:14px;line-height:1.6;">Hi ${firstName},</p>
      <p style="font-size:14px;line-height:1.6;">Congratulations! Your account has been set up on <strong>Overwatch</strong>, our workforce management platform. Here's what to do next:</p>
      <ol style="font-size:14px;line-height:1.8;padding-left:20px;">
        <li>Go to <a href="${appUrl}/register" style="color:#2563eb;">${appUrl}/register</a> and create your account using this email address.</li>
        <li>Use join code <strong style="font-family:monospace;background:#f3f4f6;padding:2px 6px;border-radius:4px;">${joinCode}</strong> to join the team.</li>
        <li>Complete your onboarding checklist in the app.</li>
      </ol>
      ${communityLink ? `<p style="font-size:14px;line-height:1.6;">Join our team chat: <a href="${communityLink}" style="color:#2563eb;">${communityLink}</a></p>` : ""}
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
      <p style="font-size:12px;color:#999;">This email was sent by ${companyName} via Overwatch.</p>
    </div>
  `;
  return {
    to: "", // caller must set
    subject: `Welcome to ${companyName} — Get Started on Overwatch`,
    html,
  };
}

export function buildShiftReminderEmail(params: {
  firstName: string;
  companyName: string;
  shiftDate: string;
  shiftTime: string;
  location?: string;
}): EmailParams {
  const { firstName, companyName, shiftDate, shiftTime, location } = params;
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a1a;">
      <h2 style="font-size:18px;margin-bottom:4px;">Shift Reminder</h2>
      <p style="font-size:14px;line-height:1.6;">Hi ${firstName}, you have an upcoming shift:</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0;font-size:14px;"><strong>Date:</strong> ${shiftDate}</p>
        <p style="margin:4px 0 0;font-size:14px;"><strong>Time:</strong> ${shiftTime}</p>
        ${location ? `<p style="margin:4px 0 0;font-size:14px;"><strong>Location:</strong> ${location}</p>` : ""}
      </div>
      <p style="font-size:12px;color:#999;">— ${companyName} via Overwatch</p>
    </div>
  `;
  return {
    to: "",
    subject: `Shift Reminder — ${shiftDate} at ${shiftTime}`,
    html,
  };
}

export function buildTimeChangeNotificationEmail(params: {
  managerName: string;
  employeeName: string;
  companyName: string;
  originalIn: string;
  originalOut: string;
  requestedIn?: string;
  requestedOut?: string;
  reason: string;
}): EmailParams {
  const { managerName, employeeName, companyName, originalIn, originalOut, requestedIn, requestedOut, reason } = params;
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a1a;">
      <h2 style="font-size:18px;margin-bottom:4px;">Time Correction Request</h2>
      <p style="font-size:14px;line-height:1.6;">Hi ${managerName}, <strong>${employeeName}</strong> has requested a time correction:</p>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0;font-size:13px;"><strong>Original:</strong> ${originalIn} — ${originalOut}</p>
        ${requestedIn ? `<p style="margin:4px 0 0;font-size:13px;"><strong>Requested In:</strong> ${requestedIn}</p>` : ""}
        ${requestedOut ? `<p style="margin:4px 0 0;font-size:13px;"><strong>Requested Out:</strong> ${requestedOut}</p>` : ""}
        <p style="margin:8px 0 0;font-size:13px;"><strong>Reason:</strong> <em>${reason}</em></p>
      </div>
      <p style="font-size:14px;">Review this request in the <strong>Personnel → Corrections</strong> tab.</p>
      <p style="font-size:12px;color:#999;">— ${companyName} via Overwatch</p>
    </div>
  `;
  return {
    to: "",
    subject: `Time Correction Request from ${employeeName}`,
    html,
  };
}

// ─── Helpers ──────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}
