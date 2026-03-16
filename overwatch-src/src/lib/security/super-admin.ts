/**
 * Super Admin — Platform-level administrator access
 *
 * Only the Evenfall Advantage admin account has access to:
 * - Security Center (audit logs, threat monitoring)
 * - Cross-company visibility (future)
 */

const SUPER_ADMIN_EMAILS = [
  "admin@evenfalladvantage.com",
];

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}
