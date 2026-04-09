/**
 * Fillout Webhook Receiver (Edge Function)
 *
 * Receives form submissions from Fillout and creates applicant records
 * in the Overwatch DB. Maps Fillout field names to applicant fields.
 *
 * No JWT required — Fillout calls server-to-server.
 * Webhook secret is verified against the company's integrations_config.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { getCorsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req.headers.get('origin')) })
  }

  try {
    const body = await req.json()

    // Extract company ID from query param or payload
    const url = new URL(req.url)
    const companyId = url.searchParams.get('company_id') || body.company_id
    if (!companyId) {
      return new Response(
        JSON.stringify({ error: 'Missing company_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Create service-role client for DB operations
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.0')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify webhook secret if provided
    const authHeader = req.headers.get('authorization') || req.headers.get('x-webhook-secret')
    if (authHeader) {
      const { data: config } = await supabase
        .from('integrations_config')
        .select('config')
        .eq('company_id', companyId)
        .eq('provider', 'fillout')
        .eq('is_active', true)
        .maybeSingle()

      if (config?.config?.webhook_secret) {
        const expected = config.config.webhook_secret
        const provided = authHeader.replace(/^Bearer\s+/i, '')
        if (provided !== expected) {
          return new Response(
            JSON.stringify({ error: 'Invalid webhook secret' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    // Parse Fillout submission fields from various payload formats
    const fields = extractFields(body)

    const applicantData = {
      id: crypto.randomUUID(),
      company_id: companyId,
      first_name: fields.first_name || fields.firstName || fields['First Name'] || '',
      last_name: fields.last_name || fields.lastName || fields['Last Name'] || '',
      email: fields.email || fields.Email || fields['Email Address'] || '',
      phone: fields.phone || fields.Phone || fields['Phone Number'] || null,
      guard_card_number: fields.guard_card || fields['Guard Card Number'] || fields.guard_card_number || null,
      experience: fields.experience || fields.Experience || fields['Work Experience'] || null,
      availability: fields.availability || fields.Availability || null,
      source: 'fillout',
      status: 'applied',
      metadata: { fillout_submission_id: body.submission_id || body.id || null, raw_fields: fields },
      created_at: new Date().toISOString(),
    }

    if (!applicantData.first_name || !applicantData.email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields (first_name, email)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { error } = await supabase.from('applicants').insert(applicantData)
    if (error) {
      console.error('[Fillout Webhook] Insert error:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, applicant_id: applicantData.id }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[Fillout Webhook] Error:', error.message)
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Extract a flat key-value map from various Fillout webhook formats.
 */
function extractFields(body: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {}

  // Format 1: { fields: [{ name, value }] }
  if (Array.isArray(body.fields)) {
    for (const f of body.fields as { name?: string; key?: string; value?: unknown }[]) {
      const key = f.name || f.key || ''
      if (key && f.value != null) result[key] = String(f.value)
    }
    return result
  }

  // Format 2: { data: { field_name: value } }
  if (body.data && typeof body.data === 'object') {
    for (const [k, v] of Object.entries(body.data as Record<string, unknown>)) {
      if (v != null) result[k] = String(v)
    }
    return result
  }

  // Format 3: { submission: { fields: [...] } }
  const sub = body.submission as Record<string, unknown> | undefined
  if (sub?.fields && Array.isArray(sub.fields)) {
    for (const f of sub.fields as { name?: string; key?: string; value?: unknown }[]) {
      const key = f.name || f.key || ''
      if (key && f.value != null) result[key] = String(f.value)
    }
    return result
  }

  // Fallback: treat top-level keys as fields
  for (const [k, v] of Object.entries(body)) {
    if (typeof v === 'string' || typeof v === 'number') {
      result[k] = String(v)
    }
  }
  return result
}
