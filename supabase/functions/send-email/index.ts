// Evenfall Advantage - Email Sending Function
// Sends enrollment notifications via Resend API

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { getCorsHeaders } from '../_shared/cors.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req.headers.get('origin')) })
  }

  try {
    // Verify the caller is an administrator or instructor
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
      )
    }
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.0')
    const verifyClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user: caller } } = await verifyClient.auth.getUser()
    if (!caller) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
      )
    }
    // Check if caller is admin or instructor
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data: adminRow } = await adminClient.from('administrators').select('id').eq('user_id', caller.id).single()
    const { data: instructorRow } = await adminClient.from('instructors').select('id').eq('id', caller.id).eq('is_active', true).single()
    if (!adminRow && !instructorRow) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: admin or instructor access required' }),
        { status: 403, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { to, subject, html } = await req.json()

    // Validate inputs
    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, html' }),
        { 
          status: 400, 
          headers: { ...getCorsHeaders(req.headers.get('origin')), "Content-Type": "application/json" } 
        }
      )
    }

    // Check if API key is configured
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { 
          status: 500, 
          headers: { ...getCorsHeaders(req.headers.get('origin')), "Content-Type": "application/json" } 
        }
      )
    }

    console.log(`Sending email to: ${to}`)

    // Send email via Resend API
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'Evenfall Advantage <info@evenfalladvantage.com>',
        to: [to],
        subject: subject,
        html: html
      })
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Resend API error:', data)
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: data }),
        { 
          status: res.status, 
          headers: { ...getCorsHeaders(req.headers.get('origin')), "Content-Type": "application/json" } 
        }
      )
    }

    console.log('Email sent successfully:', data)

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...getCorsHeaders(req.headers.get('origin')), "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error('Email function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
        { 
          status: 500, 
          headers: { ...getCorsHeaders(req.headers.get('origin')), "Content-Type": "application/json" } 
        }
    )
  }
})

/* 
SETUP INSTRUCTIONS:

1. Get Resend API Key:
   - Go to https://resend.com and sign up
   - Create an API key
   
2. Set the API key as a secret:
   npx supabase secrets set RESEND_API_KEY=re_your_api_key_here

3. Deploy this function:
   npx supabase functions deploy send-email

4. Update the 'from' email address above with your verified domain
   (or use onboarding@resend.dev for testing)

5. Enable the email sending code in:
   instructor-portal/js/instructor-enrollment.js (line 192-193)
*/
