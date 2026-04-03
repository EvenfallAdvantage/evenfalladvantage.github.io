// Allowed origins for CORS
const allowedOrigins = [
  'https://www.evenfalladvantage.com',
  'https://evenfalladvantage.github.io',
  'http://localhost:3000', // for local development
];

// Helper to get CORS headers based on request origin
export function getCorsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  };
  if (allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

// For backward compatibility, export a default corsHeaders that uses '*'
// @deprecated Use getCorsHeaders instead
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};