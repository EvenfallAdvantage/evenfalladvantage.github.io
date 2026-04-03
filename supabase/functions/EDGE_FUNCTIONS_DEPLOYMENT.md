# Edge Functions Deployment Guide

## Overview

This guide covers deploying the course payment processing Edge Functions to Supabase.

## Prerequisites

1. **Supabase CLI installed**
   ```bash
   npm install -g supabase
   ```

2. **Stripe Account**
   - Sign up at https://stripe.com
   - Get your API keys from the Dashboard

3. **Supabase Project**
   - Your project should already be set up
   - You need the project reference ID

## Environment Variables

Set these secrets in your Supabase project:

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Set Stripe secret key
supabase secrets set STRIPE_SECRET_KEY=sk_test_...

# Set Stripe webhook secret (get this after creating webhook in Stripe Dashboard)
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

## Edge Functions

### 1. create-checkout-session

**Purpose:** Creates a Stripe Checkout session for course purchase

**Endpoint:** `https://YOUR_PROJECT_REF.supabase.co/functions/v1/create-checkout-session`

**Method:** POST

**Request Body:**
```json
{
  "courseId": "uuid-of-course",
  "studentId": "uuid-of-student",
  "successUrl": "https://yourdomain.com/success",
  "cancelUrl": "https://yourdomain.com/cancel"
}
```

**Response:**
```json
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/..."
}
```

**Deploy:**
```bash
supabase functions deploy create-checkout-session
```

### 2. process-course-payment

**Purpose:** Handles Stripe webhook events for payment processing

**Endpoint:** `https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-course-payment`

**Method:** POST (called by Stripe webhooks)

**Events Handled:**
- `checkout.session.completed` - Creates enrollment after successful payment
- `payment_intent.succeeded` - Updates payment status
- `payment_intent.payment_failed` - Marks payment as failed
- `charge.refunded` - Handles refunds and cancels enrollment

**Deploy:**
```bash
supabase functions deploy process-course-payment
```

## Stripe Webhook Setup

1. **Go to Stripe Dashboard** → Developers → Webhooks

2. **Add endpoint:**
   - URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-course-payment`
   - Events to send:
     - `checkout.session.completed`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `charge.refunded`

3. **Copy the webhook signing secret** (starts with `whsec_`)

4. **Set it in Supabase:**
   ```bash
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   ```

## Testing

### Test Mode

Use Stripe test keys for development:
- Test Secret Key: `sk_test_...`
- Test Publishable Key: `pk_test_...`

### Test Cards

Stripe provides test card numbers:
- **Success:** 4242 4242 4242 4242
- **Decline:** 4000 0000 0000 0002
- **Requires Auth:** 4000 0025 0000 3155

Use any future expiration date and any 3-digit CVC.

### Local Testing

1. **Run functions locally:**
   ```bash
   supabase functions serve
   ```

2. **Test with curl:**
   ```bash
   curl -X POST http://localhost:54321/functions/v1/create-checkout-session \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -d '{
       "courseId": "course-uuid",
       "studentId": "student-uuid"
     }'
   ```

3. **Test webhooks with Stripe CLI:**
   ```bash
   stripe listen --forward-to localhost:54321/functions/v1/process-course-payment
   stripe trigger checkout.session.completed
   ```

## Production Deployment

1. **Switch to live Stripe keys:**
   ```bash
   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
   ```

2. **Update webhook endpoint** in Stripe Dashboard to use production URL

3. **Deploy functions:**
   ```bash
   supabase functions deploy create-checkout-session
   supabase functions deploy process-course-payment
   ```

4. **Test with real payment** (use small amount first)

## Monitoring

### View Function Logs

```bash
supabase functions logs create-checkout-session
supabase functions logs process-course-payment
```

### Stripe Dashboard

- Monitor payments in Stripe Dashboard → Payments
- Check webhook deliveries in Developers → Webhooks
- View failed webhooks and retry them

## Troubleshooting

### Webhook Signature Verification Failed

- Ensure `STRIPE_WEBHOOK_SECRET` is set correctly
- Check that the webhook endpoint URL matches exactly
- Verify the webhook is sending to the correct environment (test vs live)

### Payment Created But No Enrollment

- Check Edge Function logs for errors
- Verify RLS policies allow service role to insert enrollments
- Check that course_id and student_id are valid UUIDs

### CORS Errors

- Edge Functions include CORS headers
- Ensure you're calling from an allowed origin
- Check browser console for specific CORS errors

## All Edge Functions

| Function | Purpose | JWT Required | Admin Check |
|----------|---------|-------------|-------------|
| `create-checkout-session` | Creates Stripe Checkout session | Yes (default) | No |
| `process-course-payment` | Handles Stripe webhooks | No (webhook) | No (signature verified) |
| `send-email` | Sends email via Resend API | Yes | Yes (admin or instructor) |
| `send-welcome-email` | Sends welcome email to new students | Yes | Yes (admin) |
| `create-student` | Creates student account | Yes | Yes (admin) |
| `delete-student` | Deletes student account | Yes | Yes (admin) |

### Deploy All Functions

```bash
npx supabase link --project-ref vaagvairvwmgyzsmymhs
npx supabase functions deploy send-email
npx supabase functions deploy send-welcome-email
npx supabase functions deploy create-student
npx supabase functions deploy delete-student
npx supabase functions deploy create-checkout-session
npx supabase functions deploy process-course-payment
```

## Security (Updated April 2026)

### CORS Hardening

All Edge Functions use a shared CORS module (`_shared/cors.ts`) that restricts origins to:
- `https://www.evenfalladvantage.com`
- `https://evenfalladvantage.github.io`
- `http://localhost:3000` (development only)

The wildcard `*` origin is no longer used. Each function calls `getCorsHeaders(req.headers.get('origin'))` to dynamically set the `Access-Control-Allow-Origin` header.

### JWT Verification

`send-email` has `verify_jwt = true` in `config.toml` (previously `false`). All functions except `process-course-payment` (which uses Stripe webhook signature verification) require a valid JWT.

### Admin Role Verification

`create-student`, `delete-student`, and `send-email` verify that the authenticated caller exists in the `administrators` table (or `instructors` table for send-email) before executing. Unauthorized callers receive a `403 Forbidden` response.

### Webhook Signature Enforcement

`process-course-payment` now **rejects** requests missing the `stripe-signature` header or `STRIPE_WEBHOOK_SECRET` environment variable. Previously it fell back to parsing unsigned JSON, which was a security bypass.

## Security Checklist

- ✅ CORS restricted to specific origins (no wildcard)
- ✅ JWT verification on all non-webhook functions
- ✅ Admin/instructor role checks on sensitive functions
- ✅ Webhook signature verification enforced (no unsigned fallback)
- ✅ Stripe keys stored as Supabase secrets (not in code)
- ✅ RLS policies prevent unauthorized access
- ✅ HTTPS only for production webhooks

---

**Last Updated:** April 3, 2026
