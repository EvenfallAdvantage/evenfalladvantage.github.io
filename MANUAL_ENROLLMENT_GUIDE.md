# Manual Course Enrollment Guide (Stripe Placeholder)

## Overview

This guide explains how to manually enroll students in courses while payment processing (Stripe) is not yet configured.

---

## Quick Start

### Enroll All Students in Unarmed Guard Core

Run this in Supabase SQL Editor:

```sql
-- File: sql/MANUAL_ENROLLMENT.sql (Option 1)
-- This enrolls ALL existing students with complimentary access
```

The script is already set up - just run `MANUAL_ENROLLMENT.sql` and it will:
- Find all students in your database
- Enroll them in "Unarmed Guard Core" 
- Set enrollment type as "comp" (complimentary)
- Set status as "active"
- Students can immediately access all modules

---

## Enrollment Options

### Option 1: Enroll All Students (Default)

The main script in `MANUAL_ENROLLMENT.sql` enrolls all existing students automatically.

**Use this when:**
- You want to give everyone access during testing
- You're launching to all current students
- You want to grandfather in existing users

**To run:**
1. Open Supabase SQL Editor
2. Open `sql/MANUAL_ENROLLMENT.sql`
3. Run the script (Option 1 is uncommented by default)

### Option 2: Enroll Specific Student by Email

**Use this when:**
- You want to enroll individual students
- Testing with specific accounts
- Granting access to VIP/beta users

**To run:**
1. Open `sql/MANUAL_ENROLLMENT.sql`
2. Find Option 2 (commented out)
3. Uncomment the block
4. Replace `'student@example.com'` with actual email
5. Run the script

### Option 3: Enroll Multiple Specific Students

**Use this when:**
- You have a list of students to enroll
- Batch enrollment for a group
- Enrolling a class or cohort

**To run:**
1. Open `sql/MANUAL_ENROLLMENT.sql`
2. Find Option 3 (commented out)
3. Uncomment the block
4. Add student emails to the array
5. Run the script

---

## What Students See

### Before Enrollment
- Course appears in "Available Courses"
- Shows price: $299.99
- "Purchase" button visible
- Clicking "Purchase" shows: "Payment processing is not yet configured. Please contact support to enroll in this course."

### After Manual Enrollment
- Course moves to "My Courses" section
- Shows "ENROLLED" badge
- Displays progress bar (0% initially)
- "Continue" button to access modules
- Can access all course modules immediately

---

## Verification

### Check Enrollments

```sql
-- See all enrollments
SELECT 
    s.email,
    s.first_name,
    s.last_name,
    c.course_name,
    sce.enrollment_type,
    sce.enrollment_status,
    sce.completion_percentage
FROM student_course_enrollments sce
JOIN students s ON sce.student_id = s.id
JOIN courses c ON sce.course_id = c.id
ORDER BY sce.purchase_date DESC;
```

### Count Enrollments

```sql
-- Count by enrollment type
SELECT 
    c.course_name,
    COUNT(*) as total_enrollments,
    COUNT(CASE WHEN sce.enrollment_type = 'comp' THEN 1 END) as complimentary,
    COUNT(CASE WHEN sce.enrollment_type = 'paid' THEN 1 END) as paid
FROM student_course_enrollments sce
JOIN courses c ON sce.course_id = c.id
GROUP BY c.course_name;
```

---

## Enrollment Types Explained

| Type | Description | Use Case |
|------|-------------|----------|
| **comp** | Complimentary | Admin-granted free access |
| **free** | Free Course | Course price is $0 |
| **paid** | Paid | Purchased through Stripe |
| **trial** | Trial Access | Time-limited trial period |

When you manually enroll students, they get `comp` type, which means:
- ✅ Full access to all course content
- ✅ No expiration date
- ✅ Counts toward completion statistics
- ✅ Can earn certificates
- ℹ️ Shows as "complimentary" in reports

---

## Remove Enrollment (If Needed)

### Remove Specific Student

```sql
DELETE FROM student_course_enrollments
WHERE student_id = (SELECT id FROM students WHERE email = 'student@example.com')
AND course_id = (SELECT id FROM courses WHERE course_code = 'unarmed-guard-core');
```

### Remove All Enrollments

```sql
DELETE FROM student_course_enrollments
WHERE course_id = (SELECT id FROM courses WHERE course_code = 'unarmed-guard-core');
```

---

## Transitioning to Stripe Later

When you're ready to set up Stripe payment processing:

1. **Existing enrollments are preserved**
   - Students with `comp` type keep their access
   - No changes needed to their enrollments

2. **New enrollments will be `paid` type**
   - Automatically created by Edge Functions
   - Payment transactions recorded
   - Stripe handles the checkout

3. **You can still manually enroll**
   - Use the same scripts
   - Useful for comps, refunds, special cases
   - Admin override capability

4. **Reports will show both types**
   - Complimentary vs Paid clearly labeled
   - Revenue tracking for paid only
   - Completion rates for all types

---

## Testing Workflow

### Recommended Testing Steps

1. **Create test student account**
   ```
   Email: test@example.com
   Password: TestPass123!
   ```

2. **Manually enroll test student**
   ```sql
   -- Use Option 2 in MANUAL_ENROLLMENT.sql
   ```

3. **Login as test student**
   - Go to `/student-portal/login.html`
   - Login with test credentials

4. **Verify course access**
   - Navigate to "Courses" page
   - Check course appears in "My Courses"
   - Click "Continue" button

5. **Test module access**
   - Click on any module
   - Verify slideshow loads
   - Complete a module
   - Check progress updates

6. **Test assessment access**
   - Go to "Assess" page
   - Take an assessment
   - Verify completion tracking

---

## Troubleshooting

### Student Can't Access Modules

**Check enrollment status:**
```sql
SELECT * FROM student_course_enrollments 
WHERE student_id = (SELECT id FROM students WHERE email = 'student@example.com');
```

**Ensure status is 'active':**
```sql
UPDATE student_course_enrollments
SET enrollment_status = 'active'
WHERE student_id = (SELECT id FROM students WHERE email = 'student@example.com')
AND course_id = (SELECT id FROM courses WHERE course_code = 'unarmed-guard-core');
```

### Course Not Showing in "My Courses"

**Verify enrollment exists:**
```sql
SELECT * FROM student_course_enrollments sce
JOIN courses c ON sce.course_id = c.id
WHERE sce.student_id = (SELECT id FROM students WHERE email = 'student@example.com');
```

**Check course is active:**
```sql
SELECT * FROM courses WHERE course_code = 'unarmed-guard-core';
-- is_active should be true
```

### Progress Not Updating

Progress updates automatically when modules are completed. Check:

```sql
-- View module progress
SELECT 
    tm.module_name,
    smp.status,
    smp.completed_at
FROM student_module_progress smp
JOIN training_modules tm ON smp.module_id = tm.id
WHERE smp.student_id = (SELECT id FROM students WHERE email = 'student@example.com');
```

---

## Support

For questions about manual enrollment:
1. Check this guide
2. Review `sql/MANUAL_ENROLLMENT.sql` comments
3. See `COURSE_SYSTEM_IMPLEMENTATION.md` for database details

When ready to set up Stripe:
- See `COURSE_SYSTEM_DEPLOYMENT_GUIDE.md`
- See `supabase/functions/EDGE_FUNCTIONS_DEPLOYMENT.md`

---

**Last Updated:** January 23, 2026  
**Version:** 1.0  
**Status:** Active (Stripe Placeholder)
