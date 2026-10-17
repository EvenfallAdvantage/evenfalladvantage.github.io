// Evenfall Advantage - Welcome Email Function
//
// Sends a new student their login details. Callers must be signed in as an
// EADB administrator or an active instructor (same check as send-email);
// the anon / publishable key alone is rejected. Every value interpolated
// into the HTML is escaped, and nothing secret is written to the logs.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { escapeHtml, safeHttpUrl } from '../_shared/html.ts'

const DEFAULT_SITE_URL = 'https://www.evenfalladvantage.com'
const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/
const MAX_NAME_LEN = 100
const MAX_PASSWORD_LEN = 200

function json(req: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
  })
}

function isNonEmptyString(v: unknown, max: number): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req.headers.get('origin')) })
  }
  if (req.method !== 'POST') {
    return json(req, 405, { error: 'Method not allowed' })
  }

  try {
    // ── Caller must be a signed-in admin or active instructor ──────────
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return json(req, 401, { error: 'Missing authorization header' })
    }
    const verifyClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    // With only the anon/publishable key as Bearer there is no user, so
    // getUser() returns null and we reject with 401.
    const { data: { user: caller } } = await verifyClient.auth.getUser()
    if (!caller) {
      return json(req, 401, { error: 'Unauthorized' })
    }
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const { data: adminRow } = await adminClient
      .from('administrators').select('id').eq('user_id', caller.id).maybeSingle()
    const { data: instructorRow } = adminRow
      ? { data: null }
      : await adminClient
        .from('instructors').select('id').eq('id', caller.id).eq('is_active', true).maybeSingle()
    if (!adminRow && !instructorRow) {
      return json(req, 403, { error: 'Forbidden: admin or instructor access required' })
    }

    // ── Validate input ──────────────────────────────────────────────────
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return json(req, 400, { error: 'Invalid JSON body' })
    }
    const { email, password, firstName, lastName } = body
    if (typeof email !== 'string' || email.length > 254 || !EMAIL_RE.test(email.trim())) {
      return json(req, 400, { error: 'A valid email is required' })
    }
    if (!isNonEmptyString(password, MAX_PASSWORD_LEN)) {
      return json(req, 400, { error: 'password is required' })
    }
    if (!isNonEmptyString(firstName, MAX_NAME_LEN) || !isNonEmptyString(lastName, MAX_NAME_LEN)) {
      return json(req, 400, { error: 'firstName and lastName are required (max 100 characters)' })
    }

    const apiKey = Deno.env.get('RESEND_API_KEY')
    if (!apiKey) {
      console.error('send-welcome-email: RESEND_API_KEY is not configured')
      return json(req, 500, { error: 'Email service not configured' })
    }

    // ── Escape everything that goes into the HTML ───────────────────────
    const toEmail = email.trim()
    const safeFirst = escapeHtml(firstName.trim())
    const safeLast = escapeHtml(lastName.trim())
    const safeEmail = escapeHtml(toEmail)
    const safePassword = escapeHtml(password)
    const siteUrl = (safeHttpUrl(Deno.env.get('SITE_URL')) ?? DEFAULT_SITE_URL).replace(/\/+$/, '')
    const loginUrl = escapeHtml(`${siteUrl}/student-portal/login.html`)
    const year = new Date().getFullYear()

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: #253646; color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { padding: 30px 20px; background: #f9f9f9; }
    .credentials { background: white; padding: 20px; border-left: 4px solid #d59b3c; margin: 20px 0; border-radius: 5px; }
    .credentials strong { color: #253646; }
    .button { display: inline-block; padding: 15px 30px; background: #d59b3c; color: white !important; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
    .button:hover { background: #c48a33; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to Evenfall Advantage</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">Security Training &amp; Assessment Platform</p>
    </div>
    <div class="content">
      <p>Hello ${safeFirst} ${safeLast},</p>
      <p>Your student account has been created! You can now access our comprehensive security training platform.</p>

      <div class="credentials">
        <strong>Your Login Credentials:</strong><br><br>
        <strong>Email:</strong> ${safeEmail}<br>
        <strong>Temporary Password:</strong> ${safePassword}
      </div>

      <div class="warning">
        <strong>⚠️ Important Security Notice:</strong><br>
        Please change your password immediately after your first login for security purposes.
      </div>

      <center>
        <a href="${loginUrl}" class="button">Login to Portal</a>
      </center>

      <p><strong>What's Next?</strong></p>
      <ul>
        <li>Complete your profile information</li>
        <li>Start with the Communication Protocols module</li>
        <li>Take assessments to earn your certification</li>
      </ul>

      <p>If you have any questions or need assistance, please contact your administrator.</p>

      <p>Best regards,<br><strong>Evenfall Advantage Team</strong></p>
    </div>
    <div class="footer">
      <p>© ${year} Evenfall Advantage. All rights reserved.</p>
      <p>This is an automated message. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
`

    // ── Send via Resend ─────────────────────────────────────────────────
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Evenfall Advantage <noreply@evenfalladvantage.com>',
        to: [toEmail],
        subject: 'Welcome to Evenfall Advantage Training Platform',
        html,
      }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      // Log Resend's error name/message only (never the request, which
      // carries the temporary password, and never the API key).
      console.error('send-welcome-email: Resend error', response.status, data?.name ?? '', data?.message ?? '')
      return json(req, 502, { error: 'Failed to send welcome email' })
    }

    console.log('send-welcome-email: sent', data?.id ?? '')
    return json(req, 200, { success: true, messageId: data?.id ?? null })
  } catch (error) {
    console.error('send-welcome-email: unexpected error', error instanceof Error ? error.message : String(error))
    return json(req, 500, { error: 'Internal error' })
  }
})
