import { parseUTC } from "@/lib/parse-utc";

/**
 * Guard card (state security license) status for a shift.
 * Source: company_memberships.guard_card_expiry.
 *   - expired:  the card expires on or before the shift starts → assignment is blocked
 *               unless an owner/admin overrides with a reason.
 *   - expiring: expires within 30 days of the shift start → warn.
 *   - missing:  no expiry on file → warn (many companies don't record it yet).
 *   - valid
 */
export type GuardCardStatus = "valid" | "expiring" | "expired" | "missing";

export const GUARD_CARD_WARN_DAYS = 30;

export function guardCardStatus(expiry: string | null | undefined, shiftStart: string | Date): GuardCardStatus {
  if (!expiry) return "missing";
  const exp = parseUTC(expiry).getTime();
  const start = typeof shiftStart === "string" ? parseUTC(shiftStart).getTime() : shiftStart.getTime();
  if (!Number.isFinite(exp)) return "missing";
  if (exp <= start) return "expired";
  if (exp - start < GUARD_CARD_WARN_DAYS * 86_400_000) return "expiring";
  return "valid";
}
