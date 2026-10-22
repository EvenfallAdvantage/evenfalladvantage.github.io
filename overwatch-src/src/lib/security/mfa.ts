/**
 * TOTP two-factor authentication on Supabase Auth MFA.
 * Factors live in auth.mfa_factors (Supabase); nothing is stored by us.
 */
import type { Factor } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { logSecurityEvent } from "@/lib/security/audit";

export interface TotpFactor { id: string; friendlyName: string | null; status: "verified" | "unverified"; createdAt: string }

/** Company setting key (companies.settings) for "admins and owners must use 2FA". */
export const REQUIRE_MFA_ADMINS_KEY = "require_mfa_admins";

export async function listTotpFactors(): Promise<TotpFactor[]> {
  const { data, error } = await createClient().auth.mfa.listFactors();
  if (error) throw error;
  const all: Factor[] = (data?.all ?? []) as Factor[];
  return all
    .filter((f) => f.factor_type === "totp")
    .map((f: Factor) => ({ id: f.id, friendlyName: f.friendly_name ?? null, status: f.status as TotpFactor["status"], createdAt: f.created_at }));
}

export async function hasVerifiedTotp(): Promise<boolean> {
  return (await listTotpFactors()).some((f) => f.status === "verified");
}

/** Start enrollment. Returns the QR code (SVG data URL) and the manual-entry secret. */
export async function startTotpEnroll(friendlyName = "Authenticator app") {
  const supabase = createClient();
  // Drop stale unverified factors so a retry doesn't hit "factor already exists".
  for (const f of await listTotpFactors()) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `${friendlyName} ${new Date().toISOString().slice(0, 10)}` });
  if (error) throw error;
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

/** Verify a 6-digit code for a factor (finishes enrollment, or steps the session up to AAL2). */
export async function verifyTotp(factorId: string, code: string, mode: "enroll" | "login"): Promise<void> {
  const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, "") });
  if (error) {
    void logSecurityEvent({ event_type: "auth.login.failed", outcome: "failure", metadata: { method: "totp", mode } });
    throw error;
  }
  if (mode === "enroll") void logSecurityEvent({ event_type: "auth.mfa.enabled", outcome: "success", metadata: { method: "totp" } });
}

export async function removeTotp(factorId: string): Promise<void> {
  const { error } = await createClient().auth.mfa.unenroll({ factorId });
  if (error) throw error;
  void logSecurityEvent({ event_type: "auth.mfa.disabled", outcome: "success", metadata: { method: "totp" } });
}

/** "challenge": signed in with password but the account has 2FA and this session hasn't passed it. */
export async function getMfaState(): Promise<"ok" | "challenge"> {
  const { data, error } = await createClient().auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return "ok";
  return data.nextLevel === "aal2" && data.currentLevel !== "aal2" ? "challenge" : "ok";
}

/** Whether a company requires 2FA for this role (owner/admin only). */
export function mfaRequiredFor(role: string | undefined, settings: Record<string, unknown> | null | undefined): boolean {
  return !!settings?.[REQUIRE_MFA_ADMINS_KEY] && (role === "owner" || role === "admin");
}

/** Normalise typed/pasted codes to 6 digits. */
export function cleanCode(v: string): string {
  return v.replace(/\D/g, "").slice(0, 6);
}
