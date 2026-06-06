/**
 * Server-side email body builders for invitations, bulk broadcasts, and
 * test-sends. Mirrors the visual style of overwatch-src/src/lib/services/
 * email-service.ts but escapes every interpolated value so the templates
 * are safe to use with caller-supplied data.
 */

import { escapeHtml } from "../html.ts";

export interface InvitationTemplateParams {
  firstName: string;
  companyName: string;
  inviteUrl: string;
  inviterName?: string;
  expiresInDays: number;
}

export function buildInvitationEmail(params: InvitationTemplateParams): {
  subject: string;
  html: string;
  text: string;
} {
  const firstName = escapeHtml(params.firstName || "there");
  const companyName = escapeHtml(params.companyName);
  const inviterName = params.inviterName
    ? escapeHtml(params.inviterName)
    : null;
  // inviteUrl comes from supabase.auth.admin.generateLink — we trust it but
  // still funnel it through a JSON.stringify-style escape so it can't break
  // out of the href attribute.
  const inviteUrlHtml = escapeHtml(params.inviteUrl);
  const expires = params.expiresInDays;

  const subject = `You're invited to join ${params.companyName} on Overwatch`;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a1a;">
      <h1 style="font-size:22px;margin-bottom:4px;">You're invited to ${companyName}</h1>
      <p style="color:#666;font-size:14px;">${inviterName ? `${inviterName} added you to the roster.` : "You've been added to the roster."}</p>
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
      <p style="font-size:14px;line-height:1.6;">Hi ${firstName},</p>
      <p style="font-size:14px;line-height:1.6;">You've been invited to join <strong>${companyName}</strong> on <strong>Overwatch</strong>, our workforce coordination platform. Click below to set your password and sign in.</p>
      <p style="text-align:center;margin:32px 0;">
        <a href="${inviteUrlHtml}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Accept invitation</a>
      </p>
      <p style="font-size:12px;color:#888;line-height:1.6;">This link expires in ${expires} days. If the button doesn't work, copy and paste this URL into your browser:</p>
      <p style="font-size:12px;color:#2563eb;word-break:break-all;">${inviteUrlHtml}</p>
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
      <p style="font-size:12px;color:#999;">If you weren't expecting this invitation, you can safely ignore this email.</p>
    </div>
  `;

  const text = [
    `You're invited to ${params.companyName}`,
    "",
    `Hi ${params.firstName || "there"},`,
    "",
    `You've been invited to join ${params.companyName} on Overwatch. Set your password and sign in using the link below:`,
    "",
    params.inviteUrl,
    "",
    `This link expires in ${expires} days. If you weren't expecting this invitation, you can safely ignore this email.`,
  ].join("\n");

  return { subject, html, text };
}

export interface BroadcastTemplateParams {
  companyName: string;
  senderName: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

/**
 * Wraps a manager-authored broadcast body in the Overwatch chrome.
 * bodyHtml is expected to be sanitized BEFORE being passed in (the caller —
 * roster-bulk-email Edge Function — uses a markdown→html step plus an
 * allowlist sanitizer). We deliberately do NOT escape bodyHtml here.
 */
export function buildBroadcastEmail(params: BroadcastTemplateParams): {
  html: string;
  text: string;
} {
  const companyName = escapeHtml(params.companyName);
  const senderName = escapeHtml(params.senderName);

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a1a;">
      <p style="color:#666;font-size:12px;margin:0 0 16px 0;">Message from <strong>${senderName}</strong> at ${companyName}</p>
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:0 0 24px 0;" />
      <div style="font-size:14px;line-height:1.6;">
        ${params.bodyHtml}
      </div>
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0 12px 0;" />
      <p style="font-size:11px;color:#999;">This message was sent to all members of the ${companyName} roster via Overwatch. Reply directly to this email to reach ${senderName}.</p>
    </div>
  `;

  const text = [
    `Message from ${params.senderName} at ${params.companyName}`,
    "----",
    params.bodyText,
    "----",
    `This message was sent to all members of the ${params.companyName} roster via Overwatch.`,
  ].join("\n");

  return { html, text };
}

export interface TestSendTemplateParams {
  companyName: string;
  deliveryMethod: "smtp" | "resend" | "platform";
  fromEmail: string;
  triggeredBy: string;
}

export function buildTestSendEmail(params: TestSendTemplateParams): {
  subject: string;
  html: string;
  text: string;
} {
  const companyName = escapeHtml(params.companyName);
  const method = escapeHtml(params.deliveryMethod);
  const from = escapeHtml(params.fromEmail);
  const who = escapeHtml(params.triggeredBy);
  const ts = new Date().toISOString();

  const subject = `Overwatch email test — ${params.companyName}`;
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a1a;">
      <h1 style="font-size:20px;margin-bottom:4px;">Email delivery test succeeded</h1>
      <p style="color:#666;font-size:13px;">This is an automated test sent by Overwatch.</p>
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
      <table style="width:100%;font-size:13px;">
        <tr><td style="padding:4px 0;color:#666;">Company</td><td style="padding:4px 0;">${companyName}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Delivery method</td><td style="padding:4px 0;"><code>${method}</code></td></tr>
        <tr><td style="padding:4px 0;color:#666;">From address</td><td style="padding:4px 0;">${from}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Triggered by</td><td style="padding:4px 0;">${who}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Sent at</td><td style="padding:4px 0;">${escapeHtml(ts)}</td></tr>
      </table>
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
      <p style="font-size:12px;color:#999;">If you received this, your provider configuration is working. You can now mark this configuration verified and start sending invitations and broadcasts from this company.</p>
    </div>
  `;
  const text = [
    "Email delivery test succeeded",
    "",
    `Company: ${params.companyName}`,
    `Delivery method: ${params.deliveryMethod}`,
    `From address: ${params.fromEmail}`,
    `Triggered by: ${params.triggeredBy}`,
    `Sent at: ${ts}`,
    "",
    "If you received this, your provider configuration is working.",
  ].join("\n");

  return { subject, html, text };
}
