/**
 * Checkr Background Check Service
 *
 * Triggers background checks via Checkr's REST API
 * and handles webhook results.
 */

import { getCheckrConfig } from "./integrations";

const CHECKR_API = "https://api.checkr.com/v1";

/**
 * Create a Checkr candidate and trigger a background check invitation.
 * Returns the candidate ID on success, null on failure.
 */
export async function triggerBackgroundCheck(
  companyId: string,
  params: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  }
): Promise<string | null> {
  const cfg = await getCheckrConfig(companyId);
  if (!cfg) {
    console.warn("[Checkr] No active Checkr integration for company", companyId);
    return null;
  }

  try {
    // Step 1: Create candidate
    const candidateRes = await fetch(`${CHECKR_API}/candidates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + btoa(`${cfg.api_key}:`),
      },
      body: JSON.stringify({
        first_name: params.firstName,
        last_name: params.lastName,
        email: params.email,
        phone: params.phone ?? undefined,
      }),
    });

    if (!candidateRes.ok) {
      const err = await candidateRes.text();
      console.error(`[Checkr] Create candidate failed (${candidateRes.status}):`, err);
      return null;
    }

    const candidate = await candidateRes.json();

    // Step 2: Create invitation (sends email to candidate to authorize check)
    const invRes = await fetch(`${CHECKR_API}/invitations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + btoa(`${cfg.api_key}:`),
      },
      body: JSON.stringify({
        candidate_id: candidate.id,
        package: cfg.package_slug || "tasker_standard",
      }),
    });

    if (!invRes.ok) {
      const err = await invRes.text();
      console.error(`[Checkr] Create invitation failed (${invRes.status}):`, err);
      return candidate.id; // Candidate created but invitation failed
    }

    console.info(`[Checkr] Background check triggered for ${params.email}, candidate: ${candidate.id}`);
    return candidate.id;
  } catch (err) {
    console.error("[Checkr] Network error:", err);
    return null;
  }
}

/**
 * Parse a Checkr webhook payload.
 * Returns structured data about the background check result.
 */
export function parseCheckrWebhook(payload: Record<string, unknown>): {
  type: string;
  candidateId?: string;
  reportId?: string;
  status?: string;
} | null {
  try {
    const type = payload.type as string;
    const data = payload.data as Record<string, unknown> | undefined;
    const obj = data?.object as Record<string, unknown> | undefined;
    return {
      type,
      candidateId: (obj?.candidate_id as string) ?? undefined,
      reportId: (obj?.id as string) ?? undefined,
      status: (obj?.status as string) ?? undefined,
    };
  } catch {
    return null;
  }
}
