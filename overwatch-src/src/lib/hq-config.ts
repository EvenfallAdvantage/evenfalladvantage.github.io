/**
 * Small, pure helpers for the HQ Config page (/admin/settings).
 * Kept free of React/Supabase imports so they are easy to unit test.
 */

export type UrlCheck =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

/**
 * Normalise an optional http(s) URL typed by an admin.
 * - empty / whitespace  -> { ok: true, value: null }  (clears the field)
 * - "example.com"       -> "https://example.com"
 * - javascript:, data:, ftp:, etc. -> rejected
 */
export function normalizeHttpUrl(input: string, label = "URL"): UrlCheck {
  const raw = input.trim();
  if (!raw) return { ok: true, value: null };
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, error: `${label} is not a valid web address` };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: `${label} must start with http:// or https://` };
  }
  if (!url.hostname.includes(".") && url.hostname !== "localhost") {
    return { ok: false, error: `${label} is not a valid web address` };
  }
  return { ok: true, value: url.toString() };
}

/** HQ Config sections, in display order, used for the jump bar. */
export const HQ_SECTIONS = [
  { id: "organization", label: "Organization" },
  { id: "people", label: "People & Time" },
  { id: "operations", label: "Operations" },
  { id: "integrations", label: "Integrations" },
  { id: "developer", label: "API & Leads" },
  { id: "diagnostics", label: "Diagnostics" },
] as const;

export type HqSectionId = (typeof HQ_SECTIONS)[number]["id"];
