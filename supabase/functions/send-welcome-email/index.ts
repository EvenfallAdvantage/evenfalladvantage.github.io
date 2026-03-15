// Evenfall Advantage - Welcome Email Function
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from '../_shared/cors.ts'

console.log("Welcome Email Function Started")

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password, firstName, lastName } = await req.json()
    
    console.log(`Sending welcome email to: ${email}`)
    
    // Check if API key exists
    const apiKey = Deno.env.get('RESEND_API_KEY')
    if (!apiKey) {
      console.error('RESEND_API_KEY not found in environment')
      throw new Error('RESEND_API_KEY not configured')
    }
    console.log('API key found:', apiKey.substring(0, 10) + '...')
    
    // Send email via Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Evenfall Advantage <noreply@evenfalladvantage.com>',
        to: [email],
        subject: 'Welcome to Evenfall Advantage Training Platform',
        html: `
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
      <p style="margin: 10px 0 0 0; opacity: 0.9;">Security Training & Assessment Platform</p>
    </div>
    <div class="content">
      <p>Hello ${firstName} ${lastName},</p>
      <p>Your student account has been created! You can now access our comprehensive security training platform.</p>
      
      <div class="credentials">
        <strong>Your Login Credentials:</strong><br><br>
        <strong>Email:</strong> ${email}<br>
        <strong>Temporary Password:</strong> ${password}
      </div>
      
      <div class="warning">
        <strong>⚠️ Important Security Notice:</strong><br>
        Please change your password immediately after your first login for security purposes.
      </div>
      
      <center>
        <a href="${Deno.env.get('SITE_URL')}/student-portal/login.html" class="button">Login to Portal</a>
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
      <p>© ${new Date().getFullYear()} Evenfall Advantage. All rights reserved.</p>
      <p>This is an automated message. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
        `,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Resend API error:', data)
      console.error('Resend response status:', response.status)
      console.error('Resend response:', JSON.stringify(data))
      throw new Error(JSON.stringify(data) || 'Failed to send email')
    }

    console.log('Email sent successfully:', data.id)

    return new Response(
      JSON.stringify({ success: true, messageId: data.id }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
