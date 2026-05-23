/**
 * Intel — Cyber threats (CISA Known Exploited Vulnerabilities, last 30 days).
 * Attribution required: "CISA KEV".
 * Adapted from Osiris (github.com/simplifaisoul/osiris, MIT).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

interface CisaKevEntry {
  cveID?: string;
  vulnerabilityName?: string;
  vendorProject?: string;
  product?: string;
  dateAdded?: string;
  dueDate?: string;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const result = {
    threats: [] as Array<{
      id: string;
      name: string;
      vendor: string;
      product: string;
      severity: "CRITICAL";
      date: string;
      due: string;
      source: "CISA KEV";
    }>,
    stats: {
      cisa_total: 0,
      shadowserver: "unavailable" as "active" | "unavailable",
      active_cves: 0,
      threat_level: "ELEVATED" as "CRITICAL" | "HIGH" | "ELEVATED",
    },
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(
      "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
      { signal: AbortSignal.timeout(8_000) },
    );
    if (res.ok) {
      const data = (await res.json()) as { vulnerabilities?: CisaKevEntry[] };
      const recent = (data.vulnerabilities ?? [])
        .filter((v) => {
          if (!v.dateAdded) return false;
          const added = new Date(v.dateAdded);
          const daysAgo = (Date.now() - added.getTime()) / (1000 * 60 * 60 * 24);
          return daysAgo <= 30;
        })
        .slice(0, 10)
        .map((v) => ({
          id: v.cveID ?? "",
          name: v.vulnerabilityName ?? "",
          vendor: v.vendorProject ?? "",
          product: v.product ?? "",
          severity: "CRITICAL" as const,
          date: v.dateAdded ?? "",
          due: v.dueDate ?? "",
          source: "CISA KEV" as const,
        }));
      result.threats.push(...recent);
      result.stats.cisa_total = data.vulnerabilities?.length ?? 0;
    }
  } catch (e) {
    console.warn("[intel-cyber-threats] cisa error:", e);
  }

  try {
    const res = await fetch("https://dashboard.shadowserver.org/statistics/combined/map/", {
      signal: AbortSignal.timeout(5_000),
      headers: { Accept: "application/json" },
    });
    result.stats.shadowserver = res.ok ? "active" : "unavailable";
  } catch {
    result.stats.shadowserver = "unavailable";
  }

  result.stats.active_cves = result.threats.length;
  result.stats.threat_level =
    result.threats.length >= 8 ? "CRITICAL"
    : result.threats.length >= 4 ? "HIGH"
    : "ELEVATED";

  return new Response(JSON.stringify(result), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
    },
  });
});
