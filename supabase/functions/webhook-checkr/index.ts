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
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { getCorsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req.headers.get('origin')) })
  }

  try {
    const body = await req.json()
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
