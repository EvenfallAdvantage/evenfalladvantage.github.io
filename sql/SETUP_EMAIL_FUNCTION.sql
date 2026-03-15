-- =====================================================
-- EMAIL SETUP INSTRUCTIONS FOR INSTRUCTOR PORTAL
-- =====================================================

/*
CURRENT STATUS: 
Email notifications are prepared but NOT actually sent.
The enrollment system logs email data to the console only.

TO ENABLE ACTUAL EMAIL SENDING:
You need to create a Supabase Edge Function that sends emails.
*/

-- =====================================================
-- OPTION 1: SUPABASE EDGE FUNCTION + RESEND (RECOMMENDED)
-- =====================================================

/*
1. Install Supabase CLI if you haven't:
   npm install -g supabase

2. Initialize Supabase in your project:
   supabase init

3. Create a new Edge Function:
   supabase functions new send-email

4. Replace the contents of supabase/functions/send-email/index.ts with:
*/

/*
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

serve(async (req) => {
  try {
    const { to, subject, html } = await req.json()

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'Evenfall Advantage <noreply@yourdomain.com>', // Update with your domain
        to: [to],
        subject: subject,
        html: html
      })
    })

    const data = await res.json()

    return new Response(
      JSON.stringify(data),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
*/

/*
5. Get a Resend API key:
   - Go to https://resend.com
   - Sign up for free account
   - Create API key
   - Verify your domain (or use test mode)

6. Set the API key as a secret:
   supabase secrets set RESEND_API_KEY=your_api_key_here

7. Deploy the function:
   supabase functions deploy send-email

8. Uncomment the email sending code in:
   instructor-portal/js/instructor-enrollment.js (line 192-193)
*/

-- =====================================================
-- OPTION 2: SENDGRID EDGE FUNCTION
-- =====================================================

/*
Alternative: Use SendGrid instead of Resend

Edge Function code (supabase/functions/send-email/index.ts):

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')

serve(async (req) => {
  try {
    const { to, subject, html } = await req.json()

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SENDGRID_API_KEY}`
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: to }]
        }],
        from: {
          email: 'noreply@yourdomain.com',
          name: 'Evenfall Advantage'
        },
        subject: subject,
        content: [{
          type: 'text/html',
          value: html
        }]
      })
    })

    if (!res.ok) {
      throw new Error(`SendGrid error: ${res.status}`)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})

Setup:
1. Sign up at https://sendgrid.com
2. Create API key
3. Verify sender email
4. Set secret: supabase secrets set SENDGRID_API_KEY=your_key
5. Deploy function
*/

-- =====================================================
-- TESTING EMAIL SENDING
-- =====================================================

/*
After deploying, test the function:

1. Go to Supabase Dashboard → Edge Functions
2. Find "send-email" function
3. Click "Invoke"
4. Test with:
{
  "to": "your-test-email@example.com",
  "subject": "Test Email",
  "html": "<h1>Test</h1><p>This is a test email from Evenfall Advantage</p>"
}

If successful, uncomment the code in instructor-enrollment.js
*/

-- =====================================================
-- ENABLING RLS FOR EMAIL FUNCTION
-- =====================================================

-- The Edge Function will need to bypass RLS to read student/class data
-- This is already handled by using the service_role key in the function

-- No additional database policies needed

-- =====================================================
-- TROUBLESHOOTING
-- =====================================================

/*
Common issues:

1. "Domain not verified" - You need to verify your sending domain
   - For Resend: Add DNS records in your domain provider
   - For SendGrid: Complete sender verification
   
2. "API key invalid" - Check the secret is set correctly:
   supabase secrets list

3. Function timeout - Increase timeout in supabase.config.toml:
   [functions.send-email]
   verify_jwt = false
   timeout = 30

4. Emails going to spam:
   - Set up SPF, DKIM, and DMARC records
   - Use a verified domain, not a free email provider
   - Start with low volume to build reputation
*/

-- =====================================================
-- COST ESTIMATES
-- =====================================================

/*
RESEND (Recommended):
- Free: 100 emails/day, 3,000/month
- Paid: $20/month for 50,000 emails

SENDGRID:
- Free: 100 emails/day forever
- Paid: $19.95/month for 50,000 emails

Both have higher tiers available for larger volumes.
*/
