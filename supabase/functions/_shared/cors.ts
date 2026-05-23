// Allowed origins for CORS.
const allowedOrigins = [
  'https://www.evenfalladvantage.com',
  'https://evenfalladvantage.github.io',
  'http://localhost:3000',
];

/**
 * Helper to build CORS response headers based on the request's Origin.
 *
 * Returns an `Access-Control-Allow-Origin` only when the origin matches the
 * allowlist. Always returns `Allow-Headers`, `Allow-Methods`, and `Max-Age`
 * so browser preflights succeed without quirks on Safari / Chromium.
 *
 * Headers list includes `authorization` because the Intel functions accept
 * the Supabase anon key as Bearer for platform rate-limit accounting.
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, stripe-signature',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}