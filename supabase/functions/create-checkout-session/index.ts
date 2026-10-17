// Supabase Edge Function: create-checkout-session (deployed on the LEGACY EADB,
// project vaagvairvwmgyzsmymhs, where courses / students / payments live).
//
// Creates a Stripe Checkout session for a paid course.
//
// Auth (verify_jwt = false: the function authenticates the caller itself,
// because Overwatch users hold an OverwatchDB token, not an EADB one):
//   Authorization: Bearer <token>, either
//     * an Overwatch access token  -> verified at Overwatch GoTrue
//       (OVERWATCH_SUPABASE_URL / OVERWATCH_SUPABASE_ANON_KEY, the same
//       secrets legacy-bridge-write uses), or
//     * an EADB access token (student portal) -> verified at this project's
//       GoTrue.
//   The buyer's EADB student row is resolved from that session (id, then
//   email; created if missing, like the bridge's student.ensure). The client's
//   studentId and any price it sends are IGNORED: the amount always comes from
//   the course row.
//
// Request:  POST { courseId, successUrl?, cancelUrl? }  (redirects must stay on
//           an allowed site origin, see redirects.ts)
// Response: 200 { sessionId, url } | 400/401/404/409 { error } |
//           503 { error: 'payments_not_configured' } when STRIPE_SECRET_KEY is unset.
//
// Secrets: STRIPE_SECRET_KEY (sk_test_... or sk_live_...), OVERWATCH_SUPABASE_URL,
// OVERWATCH_SUPABASE_ANON_KEY. Fulfilment (enrolment after payment) happens in
// the process-course-payment webhook, never here.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno'
import { getCorsHeaders, isAllowedOrigin } from '../_shared/cors.ts'
import { buildCheckoutRedirects } from './redirects.ts'
import { amountCents, bearer, checkoutRefusal, isUuid } from './lib.ts'

type Buyer = { uid: string; email: string; firstName: string; lastName: string; source: 'overwatch' | 'eadb' }

async function overwatchUser(token: string): Promise<Buyer | null> {
  const url = Deno.env.get('OVERWATCH_SUPABASE_URL') ?? ''
  const key = Deno.env.get('OVERWATCH_SUPABASE_ANON_KEY') ?? ''
  if (!url || !key) return null
  const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } })
  if (!r.ok) return null
  const u = await r.json().catch(() => null)
  if (!u || !isUuid(u.id) || typeof u.email !== 'string' || !u.email) return null
  const m = u.user_metadata ?? {}
  return { uid: u.id, email: u.email.toLowerCase(), firstName: m.first_name ?? '', lastName: m.last_name ?? '', source: 'overwatch' }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const cors = getCorsHeaders(origin)
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { status: isAllowedOrigin(origin) ? 200 : 403, headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (origin && !isAllowedOrigin(origin)) return json({ error: 'origin_not_allowed' }, 403)

  const token = bearer(req.headers.get('authorization'))
  if (!token) return json({ error: 'missing_session' }, 401)

  let body: { courseId?: unknown; successUrl?: unknown; cancelUrl?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }
  const courseId = body?.courseId
  if (!isUuid(courseId)) return json({ error: 'invalid_course_id' }, 400)

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
  if (!stripeKey) return json({ error: 'payments_not_configured' }, 503)

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    // 1. Who is buying: Overwatch session first, then an EADB session.
    let buyer = await overwatchUser(token)
    if (!buyer) {
      const { data } = await db.auth.getUser(token)
      const u = data?.user
      if (u?.id && u.email) {
        const m = u.user_metadata ?? {}
        buyer = { uid: u.id, email: u.email.toLowerCase(), firstName: m.first_name ?? '', lastName: m.last_name ?? '', source: 'eadb' }
      }
    }
    if (!buyer) return json({ error: 'invalid_session' }, 401)

    // 2. The buyer's EADB student row (id, then email; create if missing).
    let { data: student } = await db.from('students').select('id, email, first_name, last_name').eq('id', buyer.uid).maybeSingle()
    if (!student) ({ data: student } = await db.from('students').select('id, email, first_name, last_name').eq('email', buyer.email).maybeSingle())
    if (!student) {
      const { data: created, error } = await db.from('students')
        .insert({ id: buyer.uid, email: buyer.email, first_name: buyer.firstName || 'Student', last_name: buyer.lastName || '' })
        .select('id, email, first_name, last_name').single()
      if (error) {
        console.error('[checkout] student create failed:', error.code, error.message)
        return json({ error: 'student_unavailable' }, 500)
      }
      student = created
      await db.from('student_profiles').upsert({ student_id: created.id }, { onConflict: 'student_id', ignoreDuplicates: true })
    }

    // 3. Course + eligibility (amount from the row, never the client).
    const { data: course } = await db.from('courses')
      .select('id, course_name, short_description, description, thumbnail_url, price, is_active')
      .eq('id', courseId).maybeSingle()
    const { data: enrolled } = await db.from('student_course_enrollments').select('id')
      .eq('student_id', student.id).eq('course_id', courseId).in('enrollment_status', ['active', 'completed']).maybeSingle()
    const refusal = checkoutRefusal(course, enrolled)
    if (refusal) return json({ error: refusal.error }, refusal.status)
    const cents = amountCents(course!.price)

    // 4. Pending payment row, then the Stripe session.
    const { data: payment, error: payErr } = await db.from('payment_transactions').insert({
      student_id: student.id, course_id: courseId, amount: cents / 100, currency: 'USD',
      payment_provider: 'stripe', status: 'pending', customer_email: student.email,
      customer_name: `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim(),
      metadata: { source: buyer.source },
    }).select('id').single()
    if (payErr) {
      console.error('[checkout] payment row failed:', payErr.code, payErr.message)
      return json({ error: 'payment_record_failed' }, 500)
    }

    const redirects = buildCheckoutRedirects({ origin, courseId, successUrl: body.successUrl, cancelUrl: body.cancelUrl })
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() })
    const description = course!.short_description || course!.description || undefined
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: cents,
          product_data: {
            name: course!.course_name,
            ...(description ? { description: String(description).slice(0, 500) } : {}),
            ...(course!.thumbnail_url ? { images: [course!.thumbnail_url] } : {}),
          },
        },
      }],
      success_url: redirects.successUrl,
      cancel_url: redirects.cancelUrl,
      customer_email: student.email,
      client_reference_id: payment.id,
      metadata: { student_id: student.id, course_id: courseId, payment_id: payment.id },
    }, { idempotencyKey: `course-checkout-${payment.id}` })

    await db.from('payment_transactions').update({ checkout_session_id: session.id, status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', payment.id)

    return json({ sessionId: session.id, url: session.url })
  } catch (err) {
    console.error('[checkout] failed:', err instanceof Error ? err.message : String(err))
    return json({ error: 'checkout_failed' }, 500)
  }
})
