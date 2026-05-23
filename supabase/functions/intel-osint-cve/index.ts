/**
 * Intel OSINT — CVE intelligence (MITRE cveawg primary, CIRCL fallback).
 * Adapted from Osiris (github.com/simplifaisoul/osiris, MIT).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { isRateLimited, getClientIp } from "../_shared/ssrf-guard.ts";

interface CvssV3 { baseScore?: number; vectorString?: string; baseSeverity?: string; }
interface MetricRow {
  cvssV3_1?: CvssV3; cvssV3_0?: CvssV3; cvssV31?: CvssV3;
  cvssV2_0?: { baseScore?: number; vectorString?: string };
  cvssV2?: { baseScore?: number; vectorString?: string };
}
interface CnaContainer {
  descriptions?: Array<{ lang?: string; value?: string }>;
  metrics?: MetricRow[];
  problemTypes?: Array<{ descriptions?: Array<{ cweId?: string; description?: string }> }>;
  references?: Array<{ url?: string }>;
  affected?: Array<{ vendor?: string; product?: string; versions?: Array<{ version?: string }> }>;
}
interface MitreCveResponse {
  cveMetadata?: { cveId?: string; datePublished?: string; dateUpdated?: string };
  containers?: { cna?: CnaContainer };
}
interface CirclCveResponse {
  id?: string; summary?: string; cvss?: number | null; cvss_vector?: string | null;
  references?: string[]; Published?: string | null; Modified?: string | null; cwe?: string | null;
}

function deriveSeverity(score: number | null): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | null {
  if (score == null) return null;
  if (score >= 9) return "CRITICAL";
  if (score >= 7) return "HIGH";
  if (score >= 4) return "MEDIUM";
  return "LOW";
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { searchParams } = new URL(req.url);
  const cve = searchParams.get("cve");
  if (!cve) {
    return new Response(JSON.stringify({ error: "Missing cve parameter" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 30, 60_000)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!/^CVE-\d{4}-\d{4,}$/i.test(cve)) {
    return new Response(
      JSON.stringify({ error: "Invalid CVE format. Expected: CVE-YYYY-NNNNN" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const upper = cve.toUpperCase();

  try {
    const res = await fetch(`https://cveawg.mitre.org/api/cve/${encodeURIComponent(upper)}`, {
      signal: AbortSignal.timeout(8_000),
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      try {
        const circlRes = await fetch(
          `https://cve.circl.lu/api/cve/${encodeURIComponent(upper)}`,
          { signal: AbortSignal.timeout(8_000), headers: { Accept: "application/json" } },
        );
        if (circlRes.ok) {
          const data = (await circlRes.json()) as CirclCveResponse;
          return new Response(
            JSON.stringify({
              id: data.id ?? upper,
              description: data.summary ?? "No description available.",
              cvss: data.cvss ?? null,
              cvss_vector: data.cvss_vector ?? null,
              severity: deriveSeverity(data.cvss ?? null),
              cwe: data.cwe ?? null,
              affected: [],
              references: (data.references ?? []).slice(0, 5),
              published: data.Published ?? null,
              modified: data.Modified ?? null,
              source: "circl",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } catch (e) {
        console.warn("[intel-osint-cve] circl error:", e);
      }

      return new Response(
        JSON.stringify({
          id: upper,
          description: "CVE details could not be retrieved at this time.",
          cvss: null, severity: null, cwe: null,
          affected: [], references: [],
          published: null, modified: null,
          source: "unavailable",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = (await res.json()) as MitreCveResponse;
    const cna = data.containers?.cna;

    const description =
      cna?.descriptions?.find((d) => d.lang === "en")?.value ??
      cna?.descriptions?.[0]?.value ??
      "No description available.";

    let cvss: number | null = null;
    let cvssVector: string | null = null;
    let severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | null = null;

    for (const m of cna?.metrics ?? []) {
      const v31 = m.cvssV3_1 ?? m.cvssV3_0 ?? m.cvssV31;
      if (v31) {
        cvss = v31.baseScore ?? null;
        cvssVector = v31.vectorString ?? null;
        if (v31.baseSeverity) {
          const up = v31.baseSeverity.toUpperCase();
          if (up === "CRITICAL" || up === "HIGH" || up === "MEDIUM" || up === "LOW") {
            severity = up;
          }
        }
        break;
      }
      const v2 = m.cvssV2_0 ?? m.cvssV2;
      if (v2) {
        cvss = v2.baseScore ?? null;
        cvssVector = v2.vectorString ?? null;
        break;
      }
    }
    if (!severity) severity = deriveSeverity(cvss);

    const problemType = cna?.problemTypes?.[0]?.descriptions?.[0];
    const cwe = problemType?.cweId ?? problemType?.description ?? null;
    const references = (cna?.references ?? []).slice(0, 5).map((r) => r.url ?? "").filter(Boolean);
    const affected = (cna?.affected ?? []).slice(0, 5).map((a) => ({
      vendor: a.vendor ?? "Unknown",
      product: a.product ?? "Unknown",
      versions: (a.versions ?? []).slice(0, 3).map((v) => v.version ?? "").filter(Boolean),
    }));

    return new Response(
      JSON.stringify({
        id: data.cveMetadata?.cveId ?? upper,
        description,
        cvss,
        cvss_vector: cvssVector,
        severity,
        cwe,
        affected,
        references,
        published: data.cveMetadata?.datePublished ?? null,
        modified: data.cveMetadata?.dateUpdated ?? null,
        source: "mitre",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[intel-osint-cve]", err);
    return new Response(JSON.stringify({ error: "CVE lookup failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
