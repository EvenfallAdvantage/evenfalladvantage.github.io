/**
 * Checkr Webhook Receiver (Edge Function)
 *
 * Receives background check status updates from Checkr and
 * updates the corresponding applicant record in Overwatch.
 *
 * Events handled:
 *   - report.completed — background check finished
 *   - invitation.completed — candidate completed the invitation flow
 *
 * No JWT required — Checkr calls server-to-server.
 * Authentication: HMAC-SHA256 signature verification via X-Checkr-Signature header.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { getCorsHeaders } from '../_shared/cors.ts'

/**
 * Verify Checkr webhook signature (HMAC-SHA256).
 * The signature is hex-encoded HMAC of the compact JSON body using the client secret.
 */
async function verifyCheckrSignature(rawBody: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature || !secret) return false
  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody))
    const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
    // Constant-time comparison
    if (expected.length !== signature.length) return false
    let result = 0
    for (let i = 0; i < expected.length; i++) {
      result |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
    }
    return result === 0
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req.headers.get('origin')) })
  }

  try {
    // Read raw body for signature verification
    const rawBody = await req.text()
    const checkrSignature = req.headers.get('x-checkr-signature')
    const checkrSecret = Deno.env.get('CHECKR_WEBHOOK_SECRET') ?? ''

    // Verify signature if secret is configured
    if (checkrSecret) {
      const valid = await verifyCheckrSignature(rawBody, checkrSignature, checkrSecret)
      if (!valid) {
        console.warn('[Checkr Webhook] Invalid signature — rejecting request')
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        )
      }
    } else {
      console.warn('[Checkr Webhook] CHECKR_WEBHOOK_SECRET not set — skipping signature verification')
    }

    const body = JSON.parse(rawBody)
    const type = body.type as string | undefined

    if (!type) {
      return new Response(
        JSON.stringify({ error: 'Missing event type' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const data = body.data?.object || body.data || {}
    const candidateId = data.candidate_id || data.id
    const status = data.status

    // Create service-role client for DB writes
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.0')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    if (type === 'report.completed') {
      const reportStatus = status // "clear", "consider", "suspended", "dispute"
      const bgCheckStatus = reportStatus === 'clear' ? 'passed'
        : reportStatus === 'consider' ? 'review'
        : 'flagged'

      const candidateEmail = data.candidate_email || data.email

      if (candidateEmail) {
        const { data: applicants } = await supabase
          .from('applicants')
          .select('id, metadata')
          .eq('email', candidateEmail)
          .order('created_at', { ascending: false })
          .limit(1)

        if (applicants && applicants.length > 0) {
          const applicant = applicants[0]
          const metadata = (applicant.metadata || {}) as Record<string, unknown>

          await supabase
            .from('applicants')
            .update({
              metadata: {
                ...metadata,
                checkr_candidate_id: candidateId,
                checkr_report_status: reportStatus,
                checkr_bg_check_status: bgCheckStatus,
                checkr_report_id: data.id,
                checkr_completed_at: new Date().toISOString(),
              },
            })
            .eq('id', applicant.id)
        }
      }
    }

    if (type === 'invitation.completed') {
      const candidateEmail = data.candidate_email || data.email
      if (candidateEmail) {
        const { data: applicants } = await supabase
          .from('applicants')
          .select('id, metadata')
          .eq('email', candidateEmail)
          .limit(1)

        if (applicants && applicants.length > 0) {
          const applicant = applicants[0]
          const metadata = (applicant.metadata || {}) as Record<string, unknown>
          await supabase
            .from('applicants')
            .update({
              metadata: {
                ...metadata,
                checkr_invitation_completed: true,
                checkr_invitation_completed_at: new Date().toISOString(),
              },
            })
            .eq('id', applicant.id)
        }
      }
    }

    return new Response(
      JSON.stringify({ received: true, type }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[Checkr Webhook] Error:', error.message)
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
