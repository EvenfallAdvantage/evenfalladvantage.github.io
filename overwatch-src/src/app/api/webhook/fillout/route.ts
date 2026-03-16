/**
 * Fillout Webhook Receiver
 *
 * Receives form submissions from Fillout and creates applicant records
 * in the Overwatch DB. Maps Fillout field names to applicant fields.
 *
 * NOTE: This route works in Next.js dev server and on proper hosting
 * (Vercel, etc.). For GitHub Pages static export, deploy as a
 * Supabase Edge Function instead.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Extract company ID from query param or payload
    const companyId = req.nextUrl.searchParams.get("company_id") || body.company_id;
    if (!companyId) {
      return NextResponse.json({ error: "Missing company_id" }, { status: 400 });
    }

    // Verify webhook secret if configured
    const authHeader = req.headers.get("authorization") || req.headers.get("x-webhook-secret");
    if (authHeader) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const { data: config } = await supabase
        .from("integrations_config")
        .select("config")
        .eq("company_id", companyId)
        .eq("provider", "fillout")
        .eq("is_active", true)
        .maybeSingle();

      if (config?.config?.webhook_secret) {
        const expected = config.config.webhook_secret;
        const provided = authHeader.replace(/^Bearer\s+/i, "");
        if (provided !== expected) {
          return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
        }
      }
    }

    // Parse Fillout submission
    // Fillout sends { submission_id, fields: [{ name, value }...] }
    // or { data: { ... } } depending on webhook format
    const fields = extractFields(body);

    const applicantData = {
      id: crypto.randomUUID(),
      company_id: companyId,
      first_name: fields.first_name || fields.firstName || fields["First Name"] || "",
      last_name: fields.last_name || fields.lastName || fields["Last Name"] || "",
      email: fields.email || fields.Email || fields["Email Address"] || "",
      phone: fields.phone || fields.Phone || fields["Phone Number"] || null,
      guard_card_number: fields.guard_card || fields["Guard Card Number"] || fields.guard_card_number || null,
      experience: fields.experience || fields.Experience || fields["Work Experience"] || null,
      availability: fields.availability || fields.Availability || null,
      source: "fillout",
      status: "applied",
      metadata: { fillout_submission_id: body.submission_id || body.id || null, raw_fields: fields },
      created_at: new Date().toISOString(),
    };

    if (!applicantData.first_name || !applicantData.email) {
      return NextResponse.json({ error: "Missing required fields (first_name, email)" }, { status: 400 });
    }

    // Insert into applicants table
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { error } = await supabase.from("applicants").insert(applicantData);
    if (error) {
      console.error("[Fillout Webhook] Insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.info(`[Fillout Webhook] Applicant created: ${applicantData.email} for company ${companyId}`);
    return NextResponse.json({ success: true, applicant_id: applicantData.id });
  } catch (err) {
    console.error("[Fillout Webhook] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * Extract a flat key-value map from various Fillout webhook formats.
 */
function extractFields(body: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};

  // Format 1: { fields: [{ name, value }] }
  if (Array.isArray(body.fields)) {
    for (const f of body.fields as { name?: string; key?: string; value?: unknown }[]) {
      const key = f.name || f.key || "";
      if (key && f.value != null) result[key] = String(f.value);
    }
    return result;
  }

  // Format 2: { data: { field_name: value } }
  if (body.data && typeof body.data === "object") {
    for (const [k, v] of Object.entries(body.data as Record<string, unknown>)) {
      if (v != null) result[k] = String(v);
    }
    return result;
  }

  // Format 3: { submission: { fields: [...] } }
  const sub = body.submission as Record<string, unknown> | undefined;
  if (sub?.fields && Array.isArray(sub.fields)) {
    for (const f of sub.fields as { name?: string; key?: string; value?: unknown }[]) {
      const key = f.name || f.key || "";
      if (key && f.value != null) result[key] = String(f.value);
    }
    return result;
  }

  // Fallback: treat top-level keys as fields
  for (const [k, v] of Object.entries(body)) {
    if (typeof v === "string" || typeof v === "number") {
      result[k] = String(v);
    }
  }
  return result;
}
