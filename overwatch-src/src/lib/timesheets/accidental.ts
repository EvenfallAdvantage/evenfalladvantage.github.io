import { parseUTC } from "@/lib/parse-utc";

/** Shifts shorter than this are almost always a test or a mis-tap. */
export const ACCIDENTAL_SHIFT_MS = 60_000;

export function isLikelyAccidental(t: { clock_in: string | null; clock_out: string | null }): boolean {
  if (!t.clock_in || !t.clock_out) return false;
  return parseUTC(t.clock_out).getTime() - parseUTC(t.clock_in).getTime() < ACCIDENTAL_SHIFT_MS;
}

/** Pending = finished, not approved, and not a sub-minute accidental entry. */
export function countsAsPending(t: { clock_in: string | null; clock_out: string | null; approved?: boolean | null }): boolean {
  return !!t.clock_out && !t.approved && !isLikelyAccidental(t);
}
