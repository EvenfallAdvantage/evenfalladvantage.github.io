# Email Notifications Setup

**Last Updated:** November 15, 2025

## ✅ Current Implementation Status

### Instructor Portal - Enrollment Emails
- ✅ **Supabase Edge Function deployed** (`send-email`)
- ✅ **Resend API integrated** with verified domain
- ✅ **Automatic enrollment notifications** when students are added to classes
- ✅ **Professional HTML email templates**
- ⚠️ **Known Issue:** 403 Forbidden errors (needs debugging)

**Configuration:**
- **Function:** `supabase/functions/send-email/index.ts`
- **API:** Resend API (`https://api.resend.com/emails`)
- **Domain:** `evenfalladvantage.com` (verified)
- **Sender:** `info@evenfalladvantage.com`
- **API Key:** Stored in Supabase secrets as `RESEND_API_KEY`

### Admin Portal - Student Account Creation
Currently, when an admin creates a student account, the credentials are shown in an alert dialog that the admin must manually share with the student.

## Automated Email Options

To fully automate email sending, you have several options:

### Option 1: Supabase Edge Function (Recommended)

**Pros**: Integrated with Supabase, secure, free tier available
**Cost**: Free for first 500K invocations/month

**Setup**:
1. Install Supabase CLI
2. Create an Edge Function:
```bash
supabase functions new send-welcome-email
```

3. Add SendGrid or Resend API:
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { email, password, firstName } = await req.json()
  
  // Use SendGrid, Resend, or similar
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SENDGRID_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email }],
        subject: 'Welcome to Evenfall Advantage'
      }],
      from: { email: 'noreply@evenfalladvantage.com' },
      content: [{
        type: 'text/plain',
        value: `Welcome ${firstName}!\n\nEmail: ${email}\nPassword: ${password}\n\nLogin: https://evenfalladvantage.com/student-portal/login.html`
      }]
    })
  })
  
  return new Response(JSON.stringify({ success: true }))
})
```

4. Deploy:
```bash
supabase functions deploy send-welcome-email
```

5. Call from admin dashboard:
```javascript
await supabase.functions.invoke('send-welcome-email', {
  body: { email, password, firstName }
})
```

### Option 2: SendGrid Direct (Simple)

**Pros**: Easy setup, reliable
**Cost**: Free for 100 emails/day, then $19.95/month for 50K emails

**Setup**:
1. Sign up at https://sendgrid.com
2. Get API key
3. Add to admin dashboard:
```javascript
async function sendWelcomeEmail(email, password, firstName) {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_SENDGRID_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email }],
        subject: 'Welcome to Evenfall Advantage'
      }],
      from: { email: 'noreply@evenfalladvantage.com' },
      content: [{
        type: 'text/html',
        value: `<h1>Welcome ${firstName}!</h1><p>Email: ${email}<br>Password: ${password}</p>`
      }]
    })
  })
  return response.json()
}
```

### Option 3: Resend (Modern Alternative)

**Pros**: Developer-friendly, great docs
**Cost**: Free for 3,000 emails/month, then $20/month for 50K emails

**Setup**:
1. Sign up at https://resend.com
2. Get API key
3. Use their simple API:
```javascript
async function sendWelcomeEmail(email, password, firstName) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_RESEND_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Evenfall Advantage <noreply@evenfalladvantage.com>',
      to: [email],
      subject: 'Welcome to Evenfall Advantage',
      html: `<h1>Welcome ${firstName}!</h1><p>Email: ${email}<br>Password: ${password}</p>`
    })
  })
  return response.json()
}
```

### Option 4: Supabase Auth Emails (Built-in)

**Pros**: Already configured, no extra service needed
**Cons**: Limited customization

Supabase already sends confirmation emails. You can customize the template in:
- Supabase Dashboard → Authentication → Email Templates

## Recommended Approach

1. **Short term**: Use the current alert dialog (already implemented)
2. **Long term**: Set up Supabase Edge Function with SendGrid or Resend

## Email Template

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #253646; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .credentials { background: white; padding: 15px; border-left: 4px solid #e74c3c; margin: 20px 0; }
    .button { display: inline-block; padding: 12px 24px; background: #e74c3c; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to Evenfall Advantage</h1>
    </div>
    <div class="content">
      <p>Hello {{firstName}},</p>
      <p>Your student account has been created! You can now access the training platform.</p>
      
      <div class="credentials">
        <strong>Your Login Credentials:</strong><br>
        Email: {{email}}<br>
        Temporary Password: {{password}}
      </div>
      
      <p><strong>Important:</strong> Please change your password after your first login.</p>
      
      <a href="{{loginUrl}}" class="button">Login to Portal</a>
      
      <p>If you have any questions, please contact your administrator.</p>
      
      <p>Best regards,<br>Evenfall Advantage Team</p>
    </div>
  </div>
</body>
</html>
```

## Security Notes

- Never expose API keys in frontend code
- Use environment variables or Supabase secrets
- Always use HTTPS
- Consider rate limiting to prevent abuse
- Log all email sends for audit purposes
