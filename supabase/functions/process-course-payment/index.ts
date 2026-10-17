// Supabase Edge Function: process-course-payment (Stripe webhook, deployed on
// the LEGACY EADB vaagvairvwmgyzsmymhs). verify_jwt MUST be false: Stripe sends
// no Supabase JWT, the request is authenticated by its Stripe signature.
//
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (whsec_... of the endpoint
// https://vaagvairvwmgyzsmymhs.supabase.co/functions/v1/process-course-payment).
// Events: checkout.session.completed, checkout.session.async_payment_succeeded,
// checkout.session.async_payment_failed, checkout.session.expired,
// charge.refunded (payment_intent.* kept for older endpoints).
//
// Fulfilment (enrolment) only for a PAID session that maps to the pending
// payment row create-checkout-session wrote (see fulfil.ts); idempotent.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno'
import { decideFulfilment, type PaymentRow } from './fulfil.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})
// Deno has no sync crypto: signature checks must use the async SubtleCrypto path.
const cryptoProvider = Stripe.createSubtleCryptoProvider()

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!webhookSecret) return json({ error: 'webhook_not_configured' }, 503)
  if (!signature) return json({ error: 'missing_signature' }, 400)

  const body = await req.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, undefined, cryptoProvider)
  } catch (err) {
    console.error('Webhook signature verification failed:', err instanceof Error ? err.message : String(err))
    return json({ error: 'invalid_signature' }, 400)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  try {
    console.log('Processing event:', event.type, event.id)
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await handleCheckoutCompleted(supabase, event.data.object as Stripe.Checkout.Session)
        break
      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired':
        await markSession(supabase, event.data.object as Stripe.Checkout.Session,
          event.type === 'checkout.session.expired' ? 'cancelled' : 'failed')
        break
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(supabase, event.data.object as Stripe.PaymentIntent)
        break
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(supabase, event.data.object as Stripe.PaymentIntent)
        break
      case 'charge.refunded':
        await handleRefund(supabase, event.data.object as Stripe.Charge)
        break
      default:
        console.log(`Unhandled event type: ${event.type}`)
    }
    return json({ received: true })
  } catch (error) {
    // 500 makes Stripe retry; the handlers are idempotent.
    console.error('Error processing webhook:', error instanceof Error ? error.message : String(error))
    return json({ error: 'processing_failed' }, 500)
  }
})

// deno-lint-ignore no-explicit-any
type Db = any

async function handleCheckoutCompleted(supabase: Db, session: Stripe.Checkout.Session) {
  const paymentId = session.metadata?.payment_id || session.client_reference_id || ''
  const { data: row, error: rowErr } = paymentId
    ? await supabase.from('payment_transactions').select('id, student_id, course_id, amount, status').eq('id', paymentId).maybeSingle()
    : { data: null, error: null }
  if (rowErr) throw new Error(`payment lookup: ${rowErr.message}`)

  const d = decideFulfilment({
    id: session.id, payment_status: session.payment_status, amount_total: session.amount_total,
    currency: session.currency, client_reference_id: session.client_reference_id,
    metadata: (session.metadata ?? {}) as Record<string, string>,
  }, row as PaymentRow | null)

  if (d.action === 'skip') { console.log(`checkout ${session.id}: skipped (${d.reason})`); return }
  if (d.action === 'reject') {
    console.error(`checkout ${session.id}: NOT fulfilled (${d.reason}); needs manual review`)
    if (row) {
      await supabase.from('payment_transactions').update({ error_message: `webhook: ${d.reason}`, updated_at: new Date().toISOString() }).eq('id', row.id)
    }
    return
  }

  const now = new Date().toISOString()
  const intent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null
  const { error: payErr } = await supabase.from('payment_transactions').update({
    status: 'completed',
    transaction_id: intent,
    payment_intent_id: intent,
    checkout_session_id: session.id,
    payment_method: session.payment_method_types?.[0] || 'card',
    customer_email: session.customer_details?.email ?? session.customer_email ?? undefined,
    customer_name: session.customer_details?.name ?? undefined,
    billing_address: session.customer_details?.address ?? undefined,
    error_message: null,
    updated_at: now,
  }).eq('id', d.paymentId)
  if (payErr) throw new Error(`payment update: ${payErr.message}`)

  const { error: enrErr } = await supabase.from('student_course_enrollments').upsert({
    student_id: d.studentId,
    course_id: d.courseId,
    enrollment_status: 'active',
    enrollment_type: 'paid',
    payment_id: d.paymentId,
    amount_paid: d.amount,
    currency: 'USD',
    purchase_date: now,
    updated_at: now,
  }, { onConflict: 'student_id,course_id' })
  if (enrErr) throw new Error(`enrollment upsert: ${enrErr.message}`)
  console.log(`checkout ${session.id}: enrolled student ${d.studentId} in course ${d.courseId}`)
}

async function markSession(supabase: Db, session: Stripe.Checkout.Session, status: 'failed' | 'cancelled') {
  const paymentId = session.metadata?.payment_id || session.client_reference_id
  if (!paymentId) return
  const { error } = await supabase.from('payment_transactions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', paymentId).in('status', ['pending', 'processing'])
  if (error) throw new Error(`payment ${status}: ${error.message}`)
}

async function handlePaymentSucceeded(supabase: Db, paymentIntent: Stripe.PaymentIntent) {
  console.log('Handling payment_intent.succeeded:', paymentIntent.id)

  // Update payment transaction status
  const { error } = await supabase
    .from('payment_transactions')
    .update({
      status: 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('transaction_id', paymentIntent.id)

  if (error) {
    console.error('Error updating payment status:', error)
  }
}

async function handlePaymentFailed(supabase: Db, paymentIntent: Stripe.PaymentIntent) {
  console.log('Handling payment_intent.payment_failed:', paymentIntent.id)

  // Update payment transaction status
  const { error } = await supabase
    .from('payment_transactions')
    .update({
      status: 'failed',
      error_message: paymentIntent.last_payment_error?.message || 'Payment failed',
      updated_at: new Date().toISOString(),
    })
    .eq('transaction_id', paymentIntent.id)

  if (error) {
    console.error('Error updating payment status:', error)
  }
}

async function handleRefund(supabase: Db, charge: Stripe.Charge) {
  console.log('Handling charge.refunded:', charge.id)

  const paymentIntentId = charge.payment_intent as string

  // Update payment transaction
  const { error: paymentError } = await supabase
    .from('payment_transactions')
    .update({
      status: 'refunded',
      refund_amount: charge.amount_refunded / 100,
      refunded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('transaction_id', paymentIntentId)

  if (paymentError) {
    console.error('Error updating payment for refund:', paymentError)
    return
  }

  // Update enrollment status
  const { data: payment } = await supabase
    .from('payment_transactions')
    .select('student_id, course_id')
    .eq('transaction_id', paymentIntentId)
    .single()

  if (payment) {
    const { error: enrollmentError } = await supabase
      .from('student_course_enrollments')
      .update({
        enrollment_status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('student_id', payment.student_id)
      .eq('course_id', payment.course_id)

    if (enrollmentError) {
      console.error('Error updating enrollment for refund:', enrollmentError)
    }
  }
}
