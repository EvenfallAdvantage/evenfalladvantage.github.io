# Course System Deployment Guide

## Complete Implementation Checklist

This guide walks you through deploying the complete course system with paywall functionality.

---

## Phase 1: Database Setup

### Step 1: Run SQL Scripts in Supabase

Execute these scripts **in order** in your Supabase SQL Editor:

1. **COURSE_SYSTEM_SETUP.sql**
   ```sql
   -- Creates all course tables, triggers, and helper functions
   ```
   - Creates: courses, course_modules, student_course_enrollments, payment_transactions, etc.
   - Sets up: triggers, indexes, helper functions
   - Time: ~30 seconds

2. **MIGRATE_UNARMED_GUARD_CORE.sql**
   ```sql
   -- Creates the first course and links existing modules
   ```
   - Creates "Unarmed Guard Core" course ($299.99)
   - Links modules 0-7 to the course
   - Sets completion requirements
   - Time: ~10 seconds

3. **COURSE_SYSTEM_RLS_POLICIES.sql**
   ```sql
   -- Sets up Row Level Security
   ```
   - Configures access permissions
   - Protects payment data
   - Enables student/admin policies
   - Time: ~20 seconds

### Step 2: Verify Database

Run these verification queries:

```sql
-- Check course was created
SELECT * FROM courses WHERE course_code = 'unarmed-guard-core';

-- Check modules are linked
SELECT cm.module_order, tm.module_name
FROM course_modules cm
JOIN training_modules tm ON cm.module_id = tm.id
JOIN courses c ON cm.course_id = c.id
WHERE c.course_code = 'unarmed-guard-core'
ORDER BY cm.module_order;

-- Check RLS policies
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename LIKE 'course%'
ORDER BY tablename;
```

### Step 3: Grant Existing Students Access (Optional)

If you want to give current students free access, uncomment and run the section in `MIGRATE_UNARMED_GUARD_CORE.sql` (lines 118-145).

---

## Phase 2: Stripe Setup

### Step 1: Create Stripe Account

1. Go to https://stripe.com
2. Sign up for an account
3. Complete business verification (for production)

### Step 2: Get API Keys

**Test Mode** (for development):
1. Dashboard → Developers → API keys
2. Copy **Publishable key** (starts with `pk_test_`)
3. Copy **Secret key** (starts with `sk_test_`)

**Live Mode** (for production):
1. Toggle to "Live mode"
2. Copy **Publishable key** (starts with `pk_live_`)
3. Copy **Secret key** (starts with `sk_live_`)

### Step 3: Set Supabase Secrets

```bash
# Login to Supabase CLI
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Set Stripe secret key (use test key for development)
supabase secrets set STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
```

---

## Phase 3: Deploy Edge Functions

### Step 1: Deploy create-checkout-session

```bash
cd supabase/functions
supabase functions deploy create-checkout-session
```

Verify deployment:
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/create-checkout-session \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"courseId":"test","studentId":"test"}'
```

### Step 2: Deploy process-course-payment

```bash
supabase functions deploy process-course-payment
```

### Step 3: Set Up Stripe Webhook

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Enter URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-course-payment`
4. Select events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
5. Copy the **Signing secret** (starts with `whsec_`)
6. Set in Supabase:
   ```bash
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET
   ```

---

## Phase 4: Frontend Deployment

### Files Already Deployed

The following files are already in your repository:

**Student Portal:**
- `student-portal/courses.html` - Course catalog page
- `student-portal/css/courses.css` - Course styling
- `student-portal/js/courses.js` - Course functionality

**Modified Files:**
- `student-portal/js/slideshow.js` - Added enrollment verification

### Update Navigation (if needed)

Ensure the student portal navigation includes the Courses link:

```html
<li><a href="courses.html"><i class="fas fa-book"></i> Courses</a></li>
```

---

## Phase 5: Testing

### Test Mode Testing

1. **Browse Courses**
   - Go to `/student-portal/courses.html`
   - Verify "Unarmed Guard Core" appears
   - Check price displays correctly ($299.99)

2. **View Course Details**
   - Click "Details" button
   - Verify all 8 modules are listed
   - Check learning objectives display

3. **Test Free Enrollment** (if you created a free course)
   - Click "Enroll" on a free course
   - Verify enrollment is created
   - Check course appears in "My Courses"

4. **Test Paid Checkout**
   - Click "Purchase" on Unarmed Guard Core
   - Should redirect to Stripe Checkout
   - Use test card: `4242 4242 4242 4242`
   - Any future expiration, any 3-digit CVC
   - Complete payment
   - Verify redirect to success page
   - Check enrollment was created

5. **Test Module Access**
   - Try to access a module without enrollment
   - Should redirect to courses page
   - Enroll in course
   - Try to access module again
   - Should load successfully

6. **Test Progress Tracking**
   - Complete a module
   - Check progress bar updates
   - Verify completion percentage

### Stripe Test Cards

- **Success:** 4242 4242 4242 4242
- **Decline:** 4000 0000 0000 0002
- **Requires Authentication:** 4000 0025 0000 3155
- **Insufficient Funds:** 4000 0000 0000 9995

### Verify Webhook Events

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click on your endpoint
3. Check "Events" tab for successful deliveries
4. Verify `checkout.session.completed` was received

---

## Phase 6: Production Deployment

### Switch to Live Mode

1. **Update Stripe Keys**
   ```bash
   supabase secrets set STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_KEY
   ```

2. **Create Production Webhook**
   - Same steps as test webhook
   - Use production URL
   - Copy new signing secret
   - Update Supabase secret

3. **Test with Real Payment**
   - Use small amount first ($1 test)
   - Verify complete flow
   - Check enrollment creation
   - Test module access

4. **Update Course Price** (if needed)
   ```sql
   UPDATE courses 
   SET price = 299.99 
   WHERE course_code = 'unarmed-guard-core';
   ```

---

## Troubleshooting

### Payment Not Creating Enrollment

**Check:**
1. Webhook is receiving events (Stripe Dashboard)
2. Edge Function logs: `supabase functions logs process-course-payment`
3. Payment transaction was created in database
4. RLS policies allow service role to insert enrollments

**Fix:**
```sql
-- Check if payment exists
SELECT * FROM payment_transactions 
WHERE transaction_id = 'pi_YOUR_PAYMENT_INTENT_ID';

-- Manually create enrollment if needed
INSERT INTO student_course_enrollments (
    student_id, course_id, enrollment_status, 
    enrollment_type, amount_paid
) VALUES (
    'student-uuid', 'course-uuid', 'active', 
    'paid', 299.99
);
```

### Module Access Denied After Enrollment

**Check:**
1. Enrollment status is 'active'
2. Module is linked to course in course_modules table
3. RPC function student_has_module_access exists

**Fix:**
```sql
-- Verify enrollment
SELECT * FROM student_course_enrollments 
WHERE student_id = 'your-student-id';

-- Verify module linkage
SELECT * FROM course_modules 
WHERE course_id = 'your-course-id';

-- Test RPC function
SELECT student_has_module_access(
    'student-uuid'::uuid, 
    'module-uuid'::uuid
);
```

### Checkout Session Not Creating

**Check:**
1. Edge Function deployed correctly
2. Stripe secret key is set
3. Course and student IDs are valid UUIDs

**Fix:**
```bash
# Check function logs
supabase functions logs create-checkout-session

# Test function directly
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/create-checkout-session \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "courseId": "valid-course-uuid",
    "studentId": "valid-student-uuid"
  }'
```

---

## Monitoring

### Daily Checks

1. **Stripe Dashboard**
   - Check successful payments
   - Monitor failed payments
   - Review webhook delivery status

2. **Supabase Dashboard**
   - Check Edge Function invocations
   - Review error logs
   - Monitor database growth

3. **Student Portal**
   - Test course browsing
   - Verify enrollment flow
   - Check module access

### Weekly Reviews

1. **Revenue Report**
   ```sql
   SELECT 
       DATE(created_at) as date,
       COUNT(*) as transactions,
       SUM(amount) as revenue
   FROM payment_transactions
   WHERE status = 'completed'
   GROUP BY DATE(created_at)
   ORDER BY date DESC;
   ```

2. **Enrollment Stats**
   ```sql
   SELECT 
       c.course_name,
       COUNT(sce.id) as enrollments,
       SUM(sce.amount_paid) as revenue
   FROM student_course_enrollments sce
   JOIN courses c ON sce.course_id = c.id
   GROUP BY c.course_name;
   ```

3. **Completion Rates**
   ```sql
   SELECT 
       c.course_name,
       COUNT(*) as total_enrollments,
       COUNT(CASE WHEN sce.enrollment_status = 'completed' THEN 1 END) as completed,
       ROUND(AVG(sce.completion_percentage), 2) as avg_progress
   FROM student_course_enrollments sce
   JOIN courses c ON sce.course_id = c.id
   GROUP BY c.course_name;
   ```

---

## Adding New Courses

### Step 1: Create Course

```sql
INSERT INTO courses (
    course_code,
    course_name,
    description,
    short_description,
    price,
    duration_hours,
    difficulty_level,
    icon,
    is_active,
    display_order
) VALUES (
    'your-course-code',
    'Your Course Name',
    'Full description...',
    'Short description...',
    199.99,
    12,
    'Intermediate',
    'fa-certificate',
    true,
    2
);
```

### Step 2: Link Modules

```sql
-- Get course ID
SELECT id FROM courses WHERE course_code = 'your-course-code';

-- Link modules
INSERT INTO course_modules (course_id, module_id, module_order, is_required)
SELECT 
    'course-uuid',
    id,
    display_order,
    true
FROM training_modules
WHERE module_code IN ('module-1', 'module-2', 'module-3');
```

### Step 3: Set Completion Requirements

```sql
INSERT INTO course_completion_requirements (
    course_id,
    requirement_type,
    requirement_value,
    is_required
) VALUES (
    'course-uuid',
    'module_completion',
    '{"percentage": 100, "required_only": true}'::jsonb,
    true
);
```

---

## Support

For issues or questions:
1. Check this guide first
2. Review `COURSE_SYSTEM_IMPLEMENTATION.md`
3. Check Edge Functions deployment guide
4. Review Supabase/Stripe documentation

---

**Last Updated:** January 23, 2026  
**Version:** 1.0  
**Status:** Production Ready
