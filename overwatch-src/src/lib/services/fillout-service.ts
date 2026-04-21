/**
 * Fillout Webhook Service
 *
 * Processes incoming webhook payloads from Fillout forms (employment applications).
 * Fillout sends form submissions to a webhook URL; this service validates the
 * webhook signature and maps Fillout field data to Overwatch applicant records.
 *
 * DEPLOYMENT:
 *   This handler is designed to run as a Supabase Edge Function.
 *   The webhook URL is configured in the Fillout form settings.
 *
 * WEBHOOK FORMAT:
 *   POST with JSON body containing { submission_id, fields: [...] }
 *   Validated via HMAC-SHA256 signature in X-Fillout-Signature header.
 */

import { getActiveConfig, type ProviderKey } from "./integrations";

interface FilloutConfig {
  webhook_secret: string;
}

async function getFilloutConfig(companyId: string): Promise<FilloutConfig | null> {
  return getActiveConfig<FilloutConfig>(companyId, "fillout" as ProviderKey);
}

export interface FilloutSubmission {
  submissionId: string;
  fields: { key: string; label: string; value: string | number | boolean | null }[];
}

/**
 * Validate a Fillout webhook signature.
 * Uses HMAC-SHA256 with the configured webhook secret.
 */
export async function validateFilloutWebhook(
  companyId: string,
  payload: string,
  signature: string
): Promise<boolean> {
  const cfg = await getFilloutConfig(companyId);
  if (!cfg?.webhook_secret) return false;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(cfg.webhook_secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const expected = Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
    return expected === signature;
  } catch {
    return false;
  }
}

/**
 * Parse a Fillout webhook payload into an applicant-ready structure.
 * Maps common Fillout field labels to Overwatch applicant fields.
 */
export function parseFilloutApplicant(submission: FilloutSubmission): {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  guardCardNumber?: string;
  availability?: string;
  experience?: string;
  filloutSubmissionId: string;
} {
  const get = (keys: string[]): string => {
    for (const k of keys) {
      const field = submission.fields.find(
        f => f.label.toLowerCase().includes(k.toLowerCase()) || f.key.toLowerCase().includes(k.toLowerCase())
      );
      if (field?.value != null) return String(field.value);
    }
    return "";
  };

  return {
    firstName: get(["first name", "first_name", "given name"]),
    lastName: get(["last name", "last_name", "family name", "surname"]),
    email: get(["email", "e-mail"]),
    phone: get(["phone", "telephone", "mobile"]) || undefined,
    address: get(["address", "city", "location"]) || undefined,
    guardCardNumber: get(["guard card", "license number", "guard license"]) || undefined,
    availability: get(["availability", "available", "schedule"]) || undefined,
    experience: get(["experience", "years of experience", "background"]) || undefined,
    filloutSubmissionId: submission.submissionId,
  };
}

/**
 * Verify Fillout configuration (webhook secret is present).
 */
export async function verifyFilloutConnection(companyId: string): Promise<{ connected: boolean }> {
  const cfg = await getFilloutConfig(companyId);
  return { connected: !!cfg?.webhook_secret };
}
