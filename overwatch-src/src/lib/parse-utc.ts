/**
 * Supabase TIMESTAMPTZ can come back without 'Z' suffix —
 * ensure the string is always parsed as UTC.
 */
export function parseUTC(iso: string): Date {
  if (!iso) return new Date();
  if (iso.endsWith("Z") || iso.includes("+") || /-\d{2}(:\d{2})?$/.test(iso.slice(-6))) {
    return new Date(iso);
  }
  return new Date(iso + "Z");
}
