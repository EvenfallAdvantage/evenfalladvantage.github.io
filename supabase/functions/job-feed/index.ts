// XML Job Feed — serves job postings in Indeed XML format for auto-indexing
//
// Usage: GET /job-feed?company={slug}
// Returns: application/xml with Indeed-compatible job feed
//
// Deploy: supabase functions deploy job-feed --no-verify-jwt

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const BASE_URL = "https://evenfalladvantage.github.io"

// Simple in-memory cache (1 hour TTL — job postings change infrequently)
let cache: { key: string; xml: string; ts: number } | null = null
const CACHE_TTL_MS = 3600_000 // 1 hour

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "content-type",
      },
    })
  }

  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 })
  }

  const url = new URL(req.url)
  const slug = url.searchParams.get("company")

  if (!slug) {
    return new Response("Missing ?company= parameter", { status: 400 })
  }

  // Check cache
  const cacheKey = `feed:${slug}`
  if (cache && cache.key === cacheKey && Date.now() - cache.ts < CACHE_TTL_MS) {
    return new Response(cache.xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        "X-Cache": "HIT",
      },
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Look up company by slug
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id, name, slug")
      .eq("slug", slug)
      .maybeSingle()

    if (companyError || !company) {
      return new Response("Company not found", { status: 404 })
    }

    // Fetch active postings
    const { data: postings, error: postingsError } = await supabase
      .from("job_postings")
      .select("*")
      .eq("company_id", company.id)
      .eq("status", "active")
      .order("published_at", { ascending: false })

    if (postingsError) {
      console.error("Failed to fetch postings:", postingsError.message)
      return new Response("Internal error", { status: 500 })
    }

    const xml = generateJobFeedXML(postings ?? [], company, BASE_URL)

    // Update cache
    cache = { key: cacheKey, xml, ts: Date.now() }

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        "X-Cache": "MISS",
      },
    })
  } catch (err) {
    console.error("job-feed error:", err)
    return new Response("Internal error", { status: 500 })
  }
})

// Indeed XML feed format — mirrors generateJobFeedXML from db-postings.ts
interface JobPosting {
  id: string
  title: string
  description_html: string
  location: string | null
  employment_type: string | null
  compensation_range: string | null
  show_compensation: boolean
  published_at: string | null
  created_at: string
}

function generateJobFeedXML(
  postings: JobPosting[],
  company: { name: string; slug: string },
  baseUrl: string
): string {
  const items = postings
    .map(
      (p) => `
    <job>
      <title><![CDATA[${p.title}]]></title>
      <date>${p.published_at || p.created_at}</date>
      <referencenumber>${p.id}</referencenumber>
      <url>${baseUrl}/overwatch/careers/${company.slug}/${p.id}</url>
      <company><![CDATA[${company.name}]]></company>
      ${p.location ? `<city><![CDATA[${p.location}]]></city>` : ""}
      ${p.employment_type ? `<jobtype>${p.employment_type}</jobtype>` : ""}
      ${p.compensation_range && p.show_compensation ? `<salary><![CDATA[${p.compensation_range}]]></salary>` : ""}
      <description><![CDATA[${p.description_html.replace(/<[^>]*>/g, "")}]]></description>
    </job>`
    )
    .join("\n")

  return `<?xml version="1.0" encoding="UTF-8"?>
<source>
  <publisher>${company.name}</publisher>
  <publisherurl>${baseUrl}/overwatch/careers/${company.slug}</publisherurl>
  ${items}
</source>`
}
