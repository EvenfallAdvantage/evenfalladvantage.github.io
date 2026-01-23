// Supabase Edge Function: create-checkout-session
// Creates a Stripe Checkout session for course purchase
// Deploy with: supabase functions deploy create-checkout-session

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
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get request body
    const { courseId, studentId, successUrl, cancelUrl } = await req.json()

    if (!courseId || !studentId) {
      return new Response(
        JSON.stringify({ error: 'Missing courseId or studentId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get course details
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single()

    if (courseError || !course) {
      return new Response(
        JSON.stringify({ error: 'Course not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get student details
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('email, first_name, last_name')
      .eq('id', studentId)
      .single()

    if (studentError || !student) {
      return new Response(
        JSON.stringify({ error: 'Student not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if student is already enrolled
    const { data: existingEnrollment } = await supabase
      .from('student_course_enrollments')
      .select('*')
      .eq('student_id', studentId)
      .eq('course_id', courseId)
      .eq('enrollment_status', 'active')
      .maybeSingle()

    if (existingEnrollment) {
      return new Response(
        JSON.stringify({ error: 'Already enrolled in this course' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create pending payment transaction
    const { data: payment, error: paymentError } = await supabase
      .from('payment_transactions')
      .insert({
        student_id: studentId,
        course_id: courseId,
        amount: course.price,
        currency: 'USD',
        payment_provider: 'stripe',
        status: 'pending',
        customer_email: student.email,
        customer_name: `${student.first_name} ${student.last_name}`,
      })
      .select()
      .single()

    if (paymentError) {
      console.error('Error creating payment transaction:', paymentError)
      return new Response(
        JSON.stringify({ error: 'Failed to create payment record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: course.course_name,
              description: course.short_description || course.description,
              images: course.thumbnail_url ? [course.thumbnail_url] : [],
            },
            unit_amount: Math.round(course.price * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl || `${req.headers.get('origin')}/student-portal/courses.html?success=true&course=${courseId}`,
      cancel_url: cancelUrl || `${req.headers.get('origin')}/student-portal/courses.html?canceled=true`,
      customer_email: student.email,
      client_reference_id: payment.id,
      metadata: {
        student_id: studentId,
        course_id: courseId,
        payment_id: payment.id,
      },
    })

    // Update payment transaction with checkout session ID
    await supabase
      .from('payment_transactions')
      .update({
        checkout_session_id: session.id,
        status: 'processing',
      })
      .eq('id', payment.id)

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        url: session.url,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
