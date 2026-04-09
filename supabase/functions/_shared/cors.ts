// Allowed origins for CORS
const allowedOrigins = [
  'https://www.evenfalladvantage.com',
  'https://evenfalladvantage.github.io',
  'http://localhost:3000', // for local development
];

// Helper to get CORS headers based on request origin
export function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  };
  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}