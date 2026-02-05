# Advanced Surveillance & Stalking Recognition Course
## Database Deployment Instructions

## ⚠️ IMPORTANT: Run SQL Files in This Exact Order

The SQL files have dependencies and must be run sequentially.

---

## Step 1: Create the Course

Run this file first:
```sql
SURVEILLANCE_COURSE_SIMPLE.sql
```

This creates the base course record in the `courses` table.

---

## Step 2: Add Modules (Run in Order)

After the course is created, run these files in order:

1. `SURVEILLANCE_DETECTION_COURSE.sql` - Module 1 + assessments
2. `SURVEILLANCE_MODULES_2-4.sql` - Modules 2, 3, 4
3. `SURVEILLANCE_MODULE_5.sql` - Module 5
4. `SURVEILLANCE_MODULES_6-8.sql` - Modules 6, 7, 8

---

## Alternative: Manual Course Creation

If you encounter errors, you can create the course manually in Supabase:

### 1. Create Course Record

Go to Supabase → Table Editor → `courses` table → Insert row:

```
course_name: Advanced Surveillance & Stalking Recognition
course_code: surveillance-detection
description: Master the art of detecting physical surveillance, technical monitoring, and stalking behaviors. This comprehensive course covers surveillance detection routes (SDRs), pre-attack indicators, cyber stalking, OPSEC principles, and legal reporting procedures. Designed for both security professionals and civilians concerned about personal safety.
short_description: Comprehensive training on recognizing and responding to surveillance and stalking behaviors
duration_hours: 14
difficulty_level: Intermediate
icon: fa-eye
is_active: true
display_order: 3
```

### 2. Note the Course ID

After creating the course, note the auto-generated `id` (UUID).

### 3. Modify SQL Files

In each module SQL file, replace:
```sql
(SELECT id FROM courses WHERE course_code = 'surveillance-detection')
```

With your actual course UUID:
```sql
'your-course-uuid-here'
```

### 4. Run Module SQL Files

Now run the module SQL files in order (they'll insert modules linked to your course).

---

## Verification

After deployment, verify:

1. **Course exists**: Check `courses` table for 'surveillance-detection'
2. **8 modules created**: Check `training_modules` table for modules with codes:
   - surveillance-intro
   - pre-attack-indicators
   - physical-surveillance
   - technical-surveillance
   - cyber-stalking
   - opsec-personal-security
   - documentation-reporting
   - response-safety-planning

3. **Modules linked**: Check `course_modules` table for 8 entries linking to your course

4. **Assessments created**: Check `assessments` table for 8 assessments (one per module)

5. **Questions created**: Check `assessment_questions` table for 160 questions (20 per module)

---

## Troubleshooting

**Error: "course_code not found"**
- The course wasn't created yet
- Run SURVEILLANCE_COURSE_SIMPLE.sql first

**Error: "duplicate key value"**
- Module or course already exists
- Check existing records and delete if needed

**Error: "foreign key violation"**
- Course doesn't exist when trying to create modules
- Verify course was created successfully

---

## Quick Deploy (If No Errors)

If your database supports it, you can run all files in one transaction:

```sql
BEGIN;
\i sql/SURVEILLANCE_COURSE_SIMPLE.sql
\i sql/SURVEILLANCE_DETECTION_COURSE.sql
\i sql/SURVEILLANCE_MODULES_2-4.sql
\i sql/SURVEILLANCE_MODULE_5.sql
\i sql/SURVEILLANCE_MODULES_6-8.sql
COMMIT;
```

---

## After Deployment

The course will automatically appear in:
- Learn tab (for enrollment)
- Assess tab (for assessments)

Students can enroll and start learning immediately!
