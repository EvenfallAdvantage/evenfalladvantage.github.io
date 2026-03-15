// Supabase Edge Function: process-course-payment
// Handles Stripe webhook events for course purchases
// Deploy with: supabase functions deploy process-course-payment

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  }

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify webhook signature
    const body = await req.text()
    let event: Stripe.Event

    if (signature && webhookSecret) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
      } catch (err) {
        console.error('Webhook signature verification failed:', err)
        return new Response(
          JSON.stringify({ error: 'Webhook signature verification failed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      // For testing without webhook signature
      event = JSON.parse(body)
    }

    console.log('Processing event:', event.type)

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(supabase, session)
        break
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handlePaymentSucceeded(supabase, paymentIntent)
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handlePaymentFailed(supabase, paymentIntent)
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        await handleRefund(supabase, charge)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error processing webhook:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleCheckoutCompleted(supabase: any, session: Stripe.Checkout.Session) {
  console.log('Handling checkout.session.completed:', session.id)

  const metadata = session.metadata || {}
  const studentId = metadata.student_id
  const courseId = metadata.course_id

  if (!studentId || !courseId) {
    console.error('Missing student_id or course_id in session metadata')
    return
  }

  // Get course details
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .single()

  if (courseError || !course) {
    console.error('Course not found:', courseError)
    return
  }

  // Create payment transaction record
  const { data: payment, error: paymentError } = await supabase
    .from('payment_transactions')
    .insert({
      student_id: studentId,
      course_id: courseId,
      amount: session.amount_total ? session.amount_total / 100 : 0,
      currency: session.currency?.toUpperCase() || 'USD',
      payment_provider: 'stripe',
      transaction_id: session.payment_intent as string,
      checkout_session_id: session.id,
      status: 'completed',
      payment_method: session.payment_method_types?.[0] || 'card',
      customer_email: session.customer_email || session.customer_details?.email,
      customer_name: session.customer_details?.name,
      billing_address: session.customer_details?.address,
      metadata: {
        stripe_session: session.id,
        payment_status: session.payment_status,
      },
    })
    .select()
    .single()

  if (paymentError) {
    console.error('Error creating payment transaction:', paymentError)
    return
  }

  console.log('Payment transaction created:', payment.id)

  // Create or update enrollment
  const { data: enrollment, error: enrollmentError } = await supabase
    .from('student_course_enrollments')
    .upsert({
      student_id: studentId,
      course_id: courseId,
      enrollment_status: 'active',
      enrollment_type: 'paid',
      payment_id: payment.id,
      amount_paid: payment.amount,
      currency: payment.currency,
      purchase_date: new Date().toISOString(),
    }, {
      onConflict: 'student_id,course_id',
    })
    .select()
    .single()

  if (enrollmentError) {
    console.error('Error creating enrollment:', enrollmentError)
    return
  }

  console.log('Enrollment created/updated:', enrollment.id)

  // TODO: Send confirmation email to student
  // You can call the send-email Edge Function here
}

async function handlePaymentSucceeded(supabase: any, paymentIntent: Stripe.PaymentIntent) {
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

async function handlePaymentFailed(supabase: any, paymentIntent: Stripe.PaymentIntent) {
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

async function handleRefund(supabase: any, charge: Stripe.Charge) {
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
