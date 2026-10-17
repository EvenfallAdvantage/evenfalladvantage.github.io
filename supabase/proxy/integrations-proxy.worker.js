// Cloudflare Worker for the integrations custom domain (decision #6). NOT DEPLOYED.
// Route: api.evenfalladvantage.com/integrations/*
//   /integrations/oauth/callback/<provider>  -> integration-oauth-callback/<provider>
//   /integrations/webhook/<provider>         -> integration-webhook/<provider>
// Everything else is 404. Body, method, query and vendor signature headers are
// forwarded byte-for-byte (signatures are computed over the raw body).
const ORIGIN = "https://nneueuvyeohwnspbwfub.supabase.co/functions/v1";
const ROUTES = [
  [/^\/integrations\/oauth\/callback\/([a-z][a-z0-9_]{1,31})\/?$/, "integration-oauth-callback"],
  [/^\/integrations\/webhook\/([a-z][a-z0-9_]{1,31})\/?$/, "integration-webhook"],
];

export default {
  async fetch(request) {
    const url = new URL(request.url);
    for (const [re, fn] of ROUTES) {
      const m = url.pathname.match(re);
      if (!m) continue;
      const headers = new Headers(request.headers);
      headers.delete("host");
      headers.delete("cookie");
      return fetch(`${ORIGIN}/${fn}/${m[1]}${url.search}`, {
        method: request.method,
        headers,
        body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
        redirect: "manual",
      });
    }
    return new Response("Not found", { status: 404 });
  },
};
