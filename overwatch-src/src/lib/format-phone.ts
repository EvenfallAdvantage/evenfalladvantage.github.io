/**
 * Format a string of digits into US phone format: (XXX) XXX-XXXX
 * Strips all non-digit characters first, then formats progressively.
 */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Strip a formatted phone to raw digits only (for saving to DB).
 */
export function stripPhone(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

/**
 * Validate that a phone string has exactly 10 digits.
 * Returns true for empty strings (phone is often optional).
 */
export function isValidPhone(value: string): boolean {
  if (!value || !value.trim()) return true;
  const digits = value.replace(/\D/g, "");
  return digits.length === 10;
}
