# Course System with Paywall - Implementation Guide

## Overview

This document describes the implementation of a course-based learning system with integrated payment processing for the Evenfall Advantage platform.

## Database Schema

### New Tables Created

1. **courses** - Course catalog
2. **course_modules** - Links modules to courses
3. **student_course_enrollments** - Tracks student enrollments
4. **payment_transactions** - Payment history
5. **course_completion_requirements** - Course completion criteria
6. **course_reviews** - Student course reviews (optional)

### Modified Tables

- **training_modules** - Added `default_course_id` column

## Installation Steps

### Step 1: Run Database Setup Scripts

Execute these SQL scripts in your Supabase SQL Editor **in order**:

1. **COURSE_SYSTEM_SETUP.sql**
   - Creates all new tables
   - Adds triggers and helper functions
   - Sets up indexes

2. **MIGRATE_UNARMED_GUARD_CORE.sql**
   - Creates the "Unarmed Guard Core" course
   - Links existing modules 0-7 to the course
   - Sets up completion requirements
   - Optional: Grant existing students free access (commented out)

3. **COURSE_SYSTEM_RLS_POLICIES.sql**
   - Sets up Row Level Security policies
   - Configures access permissions
   - Grants function execution rights

### Step 2: Verify Database Setup

After running the scripts, verify the setup:

```sql
-- Check courses
SELECT * FROM courses;

-- Check course modules
SELECT 
    c.course_name,
    cm.module_order,
    tm.module_name,
    cm.is_required
FROM course_modules cm
JOIN courses c ON cm.course_id = c.id
JOIN training_modules tm ON cm.module_id = tm.id
ORDER BY c.course_name, cm.module_order;

-- Check RLS policies
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename LIKE 'course%' OR tablename = 'student_course_enrollments'
ORDER BY tablename;
```

## Course Structure

### Unarmed Guard Core Course

**Price:** $299.99  
**Duration:** 16 hours  
**Modules:** 8 (Module 0-7)

| Order | Module Code | Module Name | Required |
|-------|-------------|-------------|----------|
| 0 | welcome-materials | Welcome Materials | No |
| 1 | communication-protocols | Radio Communications | Yes |
| 2 | stop-the-bleed | STOP THE BLEED® | Yes |
| 3 | threat-assessment | Threat Assessment | Yes |
| 4 | ics-100 | ICS-100 | Yes |
| 5 | diverse-population | Diverse Populations | Yes |
| 6 | crowd-management | Crowd Management | Yes |
| 7 | use-of-force | Use of Force | Yes |

## Access Control

### Helper Functions

Two security-definer functions are provided:

1. **student_has_course_access(student_id, course_id)**
   - Returns true if student has active enrollment
   - Checks expiration dates

2. **student_has_module_access(student_id, module_id)**
   - Returns true if student is enrolled in any course containing the module
   - Used to gate module content

### Usage in JavaScript

```javascript
// Check course access
const { data: hasAccess } = await supabase
    .rpc('student_has_course_access', {
        p_student_id: userId,
        p_course_id: courseId
    });

// Check module access
const { data: canAccess } = await supabase
    .rpc('student_has_module_access', {
        p_student_id: userId,
        p_module_id: moduleId
    });
```

## Enrollment Types

- **paid** - Standard paid enrollment
- **free** - Free course access
- **trial** - Trial period access
- **comp** - Complimentary access (admin granted)

## Enrollment Status

- **active** - Currently enrolled and can access content
- **completed** - Finished all requirements
- **expired** - Time-limited access has expired
- **cancelled** - Enrollment cancelled

## Payment Integration

### Payment Providers Supported

- **stripe** - Primary payment processor (recommended)
- **paypal** - Alternative payment option
- **manual** - Manual payment processing
- **comp** - Complimentary (no payment)

### Payment Status Flow

1. **pending** - Payment initiated
2. **processing** - Payment being processed
3. **completed** - Payment successful, access granted
4. **failed** - Payment failed
5. **refunded** - Payment refunded
6. **cancelled** - Payment cancelled

## Course Completion

### Automatic Tracking

A database trigger automatically updates course completion:
- Monitors `student_module_progress` table
- Calculates completion percentage
- Updates `student_course_enrollments` record
- Sets completion date when 100% complete

### Completion Requirements

For "Unarmed Guard Core":
1. Complete 100% of required modules
2. Pass all assessments with 70% or higher

## Granting Existing Students Access

If you want to give all existing students free access to the course, uncomment the section in `MIGRATE_UNARMED_GUARD_CORE.sql` (lines 118-145) before running it.

## Next Steps

### Phase 4: Supabase Edge Functions
- Create payment webhook handler
- Implement enrollment creation on successful payment
- Set up Stripe integration

### Phase 5: Frontend - Course Catalog
- Build course listing page
- Create course detail views
- Add purchase flow UI

### Phase 6: Frontend - Access Control
- Add enrollment checks to module pages
- Update dashboard to show courses
- Implement locked/unlocked states

### Phase 7: Stripe Integration
- Set up Stripe account
- Configure Stripe Checkout
- Test payment flow

### Phase 8: Admin Tools
- Course management interface
- Enrollment management
- Revenue reporting

## Security Considerations

- All payment processing happens server-side via Edge Functions
- RLS policies prevent unauthorized data access
- Payment transactions can only be created by service role
- Students cannot modify enrollment status or payment amounts
- Helper functions use SECURITY DEFINER for consistent access checks

## Rollback Instructions

If you need to revert to the previous version:

```bash
git checkout backup-before-course-system
git push origin main --force
```

**Database Rollback:**

```sql
-- Drop new tables (in reverse order due to foreign keys)
DROP TABLE IF EXISTS course_reviews CASCADE;
DROP TABLE IF EXISTS course_completion_requirements CASCADE;
DROP TABLE IF EXISTS payment_transactions CASCADE;
DROP TABLE IF EXISTS student_course_enrollments CASCADE;
DROP TABLE IF EXISTS course_modules CASCADE;
DROP TABLE IF EXISTS courses CASCADE;

-- Remove added column
ALTER TABLE training_modules DROP COLUMN IF EXISTS default_course_id;

-- Drop helper functions
DROP FUNCTION IF EXISTS student_has_course_access(UUID, UUID);
DROP FUNCTION IF EXISTS student_has_module_access(UUID, UUID);
DROP FUNCTION IF EXISTS update_course_completion_percentage();
```

## Support

For questions or issues with the course system implementation, refer to:
- Supabase documentation: https://supabase.com/docs
- Stripe documentation: https://stripe.com/docs
- This implementation guide

---

**Created:** January 23, 2026  
**Version:** 1.0  
**Status:** Phase 1-3 Complete (Database Setup)
