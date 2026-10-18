/**
 * Intel OSINT — ASN / network lookup via RDAP + PeeringDB.
 * Accepts an IPv4 address or an ASN ("AS15169" or "15169").
 *
 *  - ASN: RIR RDAP autnum record (holder, country, abuse contact) plus the
 *    PeeringDB network profile (type, scope, prefix counts, IX/facility
 *    presence, peering policy) when the network has registered one.
 *  - IP: RIR RDAP network record (block, holder, CIDR).
 *
 * Replaces bgpview.io, which shut down on 26 Nov 2025.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireIntelUser } from "../_shared/intel-auth.ts";
import { rdapAutnum, rdapIp } from "../_shared/rdap.ts";

interface PeeringDbNet {
  id?: number; name?: string; aka?: string; website?: string;
  info_type?: string; info_scope?: string; policy_general?: string;
  info_prefixes4?: number; info_prefixes6?: number;
  ix_count?: number; fac_count?: number; irr_as_set?: string;
}

async function peeringDb(asn: number) {
  try {
    const res = await fetch(`https://www.peeringdb.com/api/net?asn=${asn}`, {
      headers: { Accept: "application/json", "User-Agent": "EvenfallAdvantage-Overwatch/1.0" },
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) { await res.body?.cancel(); return null; }
    const n = ((await res.json())?.data ?? [])[0] as PeeringDbNet | undefined;
    if (!n) return null;
    return {
      name: n.name ?? "", aka: n.aka ?? "", website: n.website ?? "",
      type: n.info_type ?? "", scope: n.info_scope ?? "", policy: n.policy_general ?? "",
      prefixes4: n.info_prefixes4 ?? null, prefixes6: n.info_prefixes6 ?? null,
      ix_count: n.ix_count ?? 0, fac_count: n.fac_count ?? 0, irr_as_set: n.irr_as_set ?? "",
      url: n.id ? `https://www.peeringdb.com/net/${n.id}` : "",
    };
  } catch (e) {
    console.warn("[intel-osint-bgp] peeringdb", e);
    return null;
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const denied = await requireIntelUser(req, corsHeaders, { limit: 30 });
  if (denied) return denied;
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  const query = new URL(req.url).searchParams.get("query")?.trim() ?? "";
  if (!query) {
    return new Response(JSON.stringify({ error: "Missing query parameter (IP or ASN)" }), { status: 400, headers: jsonHeaders });
  }
  const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(query);
  const asnMatch = query.match(/^(?:AS)?(\d{1,10})$/i);
  if (!isIP && !asnMatch) {
    return new Response(JSON.stringify({ error: "Enter an IPv4 address or ASN (e.g. AS15169)" }), { status: 400, headers: jsonHeaders });
  }

  try {
    if (asnMatch) {
      const asn = Number(asnMatch[1]);
      const [rdap, pdb] = await Promise.all([rdapAutnum(asn).catch(() => null), peeringDb(asn)]);
      return new Response(JSON.stringify({
        query, type: "asn", asn: rdap ?? undefined, peeringdb: pdb ?? undefined,
        error: rdap || pdb ? undefined : "No registry record found",
        timestamp: new Date().toISOString(),
      }), { headers: jsonHeaders });
    }
    const network = await rdapIp(query).catch(() => null);
    return new Response(JSON.stringify({
      query, type: "ip", network: network ?? undefined,
      error: network ? undefined : "No registry record found",
      timestamp: new Date().toISOString(),
    }), { headers: jsonHeaders });
  } catch (e) {
    console.error("[intel-osint-bgp]", e);
    return new Response(JSON.stringify({ error: "Lookup failed" }), { status: 502, headers: jsonHeaders });
  }
});
