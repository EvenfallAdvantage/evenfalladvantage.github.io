/**
 * HTML utilities for Edge Functions.
 *
 * Mirrors the escapeHtml implementation in overwatch-src/src/lib/security/index.ts
 * so that interpolated values in invitation / broadcast / welcome email
 * templates can't be used to inject markup or attack content.
 */

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#96;",
};

/** Escape HTML special characters to prevent XSS in templated emails. */
export function escapeHtml(str: string): string {
  if (str === null || str === undefined) return "";
  return String(str).replace(/[&<>"'`/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Reject anything that isn't an http(s) URL — used when interpolating
 * caller-supplied URLs (e.g. communityLink) into an email template.
 */
export function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}
