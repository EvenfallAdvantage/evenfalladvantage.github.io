/**
 * Intel OSINT — WHOIS via RDAP + HTTP security header score.
 * Adapted from Osiris (github.com/simplifaisoul/osiris, MIT).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { safeFetch, isRateLimited, getClientIp } from "../_shared/ssrf-guard.ts";

interface RdapEvent { eventAction?: string; eventDate?: string; }
interface RdapEntity { handle?: string; roles?: string[]; vcardArray?: unknown[]; }
interface RdapNameserver { ldhName?: string; }
interface RdapDomain {
  handle?: string;
  ldhName?: string;
  status?: string[];
  events?: RdapEvent[];
  nameservers?: RdapNameserver[];
  entities?: RdapEntity[];
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { searchParams } = new URL(req.url);
  const domain = searchParams.get("domain");
  if (!domain) {
    return new Response(JSON.stringify({ error: "Missing domain parameter" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 20, 60_000)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
    return new Response(JSON.stringify({ error: "Invalid domain format" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Record<string, unknown> = { domain, timestamp: new Date().toISOString() };

  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      signal: AbortSignal.timeout(8_000),
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = (await res.json()) as RdapDomain;
      const events = (data.events ?? []).map((e) => ({
        action: e.eventAction ?? "",
        date: e.eventDate ?? "",
      }));
      results.rdap = {
        handle: data.handle ?? "",
        name: data.ldhName ?? "",
        status: data.status ?? [],
        events,
        nameservers: (data.nameservers ?? []).map((ns) => ns.ldhName ?? "").filter(Boolean),
        entities: (data.entities ?? [])
          .map((e) => {
            const vcard = (e.vcardArray?.[1] as unknown[][]) ?? [];
            const findVcard = (key: string): string | undefined => {
              const row = vcard.find((v) => Array.isArray(v) && v[0] === key) as unknown[] | undefined;
              return row?.[3] as string | undefined;
            };
            return {
              handle: e.handle ?? "",
              roles: e.roles ?? [],
              name: findVcard("fn"),
              org: findVcard("org"),
            };
          })
          .filter((e) => e.name || e.org),
      };
      results.registration = events.find((e) => e.action === "registration")?.date;
      results.expiration = events.find((e) => e.action === "expiration")?.date;
      results.last_changed = events.find((e) => e.action === "last changed")?.date;
    }
  } catch (e) {
    console.warn("[intel-osint-whois] rdap error:", e);
  }

  try {
    const res = await safeFetch(`https://${domain}`, {
      method: "HEAD",
      signal: AbortSignal.timeout(5_000),
      maxRedirects: 3,
    });
    const headers: Record<string, string> = {};
    const headerNames = [
      "server", "x-powered-by", "x-frame-options", "strict-transport-security",
      "content-security-policy", "x-content-type-options", "x-xss-protection",
      "referrer-policy", "permissions-policy",
    ];
    for (const h of headerNames) {
      const v = res.headers.get(h);
      if (v) headers[h] = v;
    }
    results.http = {
      status: res.status,
      headers,
      redirected: res.redirected,
      final_url: res.url,
    };

    let score = 0;
    if (headers["strict-transport-security"]) score += 2;
    if (headers["content-security-policy"]) score += 2;
    if (headers["x-frame-options"]) score += 1;
    if (headers["x-content-type-options"]) score += 1;
    if (headers["referrer-policy"]) score += 1;
    results.security_score = {
      score,
      max: 7,
      grade: score >= 5 ? "A" : score >= 3 ? "B" : score >= 1 ? "C" : "F",
    };
  } catch (e) {
    console.warn("[intel-osint-whois] http error:", e);
  }

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
