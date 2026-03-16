/**
 * Hiring Orchestrator
 *
 * Coordinates all integration triggers that fire when an applicant is hired.
 * Called after `convertApplicantToUser()` completes successfully.
 *
 * Trigger chain:
 *  1. Email → Send welcome email with join code + onboarding instructions
 *  2. WhatsApp → Send welcome message + community invite link
 *  3. Checkr → Trigger background check invitation
 *  4. DocuSign → Send employment agreement for e-signature
 *  5. Notification → Create in-app notification for the new hire
 *
 * Each integration call is wrapped in try/catch and logged.
 * Failures do NOT block the hiring flow — they're logged and reported.
 */

import { sendEmail, buildWelcomeEmail } from "./email-service";
import { sendWhatsAppWelcome, getWhatsAppCommunityLink } from "./whatsapp-service";
import { triggerBackgroundCheck } from "./checkr-service";
import { sendOnboardingDocuments } from "./docusign-service";
import { isIntegrationActive } from "./integrations";

export interface HireContext {
  companyId: string;
  companyName: string;
  joinCode: string;
  appUrl: string;
  applicant: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
}

export interface HireResult {
  email: { sent: boolean; error?: string };
  whatsapp: { sent: boolean; error?: string };
  checkr: { triggered: boolean; candidateId?: string; error?: string };
  docusign: { sent: boolean; envelopeId?: string; error?: string };
}

/**
 * Run all post-hire integration triggers.
 * Returns a result object showing what succeeded/failed.
 */
export async function onApplicantHired(ctx: HireContext): Promise<HireResult> {
  const result: HireResult = {
    email: { sent: false },
    whatsapp: { sent: false },
    checkr: { triggered: false },
    docusign: { sent: false },
  };

  // Run all integration checks in parallel for speed
  const [emailActive, waActive, checkrActive, docusignActive] = await Promise.all([
    isIntegrationActive(ctx.companyId, "email"),
    isIntegrationActive(ctx.companyId, "whatsapp"),
    isIntegrationActive(ctx.companyId, "checkr"),
    isIntegrationActive(ctx.companyId, "docusign"),
  ]);

  // Get WhatsApp community link for inclusion in email
  let communityLink: string | undefined;
  if (waActive) {
    try {
      communityLink = (await getWhatsAppCommunityLink(ctx.companyId)) ?? undefined;
    } catch {}
  }

  // ─── 1. Welcome Email ────────────────────────────────
  if (emailActive) {
    try {
      const emailTemplate = buildWelcomeEmail({
        firstName: ctx.applicant.firstName,
        companyName: ctx.companyName,
        joinCode: ctx.joinCode,
        appUrl: ctx.appUrl,
        communityLink,
      });
      emailTemplate.to = ctx.applicant.email;
      const sent = await sendEmail(ctx.companyId, emailTemplate);
      result.email = { sent };
      if (!sent) result.email.error = "Email API returned failure";
    } catch (err) {
      result.email = { sent: false, error: String(err) };
      console.error("[Hire/Email]", err);
    }
  }

  // ─── 2. WhatsApp Welcome ─────────────────────────────
  if (waActive && ctx.applicant.phone) {
    try {
      const sent = await sendWhatsAppWelcome(ctx.companyId, {
        phone: ctx.applicant.phone,
        firstName: ctx.applicant.firstName,
        companyName: ctx.companyName,
        joinCode: ctx.joinCode,
        appUrl: ctx.appUrl,
      });
      result.whatsapp = { sent };
      if (!sent) result.whatsapp.error = "WhatsApp API returned failure";
    } catch (err) {
      result.whatsapp = { sent: false, error: String(err) };
      console.error("[Hire/WhatsApp]", err);
    }
  } else if (waActive && !ctx.applicant.phone) {
    result.whatsapp = { sent: false, error: "No phone number on file" };
  }

  // ─── 3. Checkr Background Check ─────────────────────
  if (checkrActive) {
    try {
      const candidateId = await triggerBackgroundCheck(ctx.companyId, {
        firstName: ctx.applicant.firstName,
        lastName: ctx.applicant.lastName,
        email: ctx.applicant.email,
        phone: ctx.applicant.phone,
      });
      result.checkr = { triggered: !!candidateId, candidateId: candidateId ?? undefined };
      if (!candidateId) result.checkr.error = "Checkr API returned failure";
    } catch (err) {
      result.checkr = { triggered: false, error: String(err) };
      console.error("[Hire/Checkr]", err);
    }
  }

  // ─── 4. DocuSign Employment Agreement ────────────────
  if (docusignActive) {
    try {
      const envelopeId = await sendOnboardingDocuments(ctx.companyId, {
        signerEmail: ctx.applicant.email,
        signerName: `${ctx.applicant.firstName} ${ctx.applicant.lastName}`,
        companyName: ctx.companyName,
      });
      result.docusign = { sent: !!envelopeId, envelopeId: envelopeId ?? undefined };
      if (!envelopeId) result.docusign.error = "DocuSign API returned failure";
    } catch (err) {
      result.docusign = { sent: false, error: String(err) };
      console.error("[Hire/DocuSign]", err);
    }
  }

  // Log summary
  const summary = Object.entries(result)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(", ");
  console.info(`[Hire] Integration results for ${ctx.applicant.email}: ${summary}`);

  return result;
}
