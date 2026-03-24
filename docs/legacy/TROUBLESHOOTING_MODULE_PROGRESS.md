# Troubleshooting Module Progress Display

## Issue: Client portal shows "0/7 modules completed" even though students have passed assessments

### Root Causes:

1. **`student_module_progress` table is empty or has wrong data**
2. **Module progress records exist for failed assessments** (should only be for passed)
3. **RLS (Row Level Security) policies blocking client access**

### Solution Steps:

## Step 1: Check Current Data

Run in Supabase SQL Editor:
```sql
-- Check what's in the database
SELECT 
    s.email,
    COUNT(DISTINCT CASE WHEN ar.passed = true THEN ar.assessment_id END) as passed_assessments,
    COUNT(DISTINCT CASE WHEN smp.status = 'completed' THEN smp.module_id END) as completed_modules
FROM students s
LEFT JOIN assessment_results ar ON s.id = ar.student_id
LEFT JOIN student_module_progress smp ON s.id = smp.student_id
GROUP BY s.email
ORDER BY s.email;
```

Expected results:
- James: 3 passed_assessments, should have 3 completed_modules
- Josiah: 7 passed_assessments, should have 7 completed_modules

## Step 2: Clean Up Failed Assessment Progress

If `completed_modules` > `passed_assessments`, run:

```sql
-- File: sql/cleanup-failed-module-progress.sql
-- This removes module progress where assessment wasn't passed
```

## Step 3: Create Missing Module Progress

If `completed_modules` < `passed_assessments`, run:

```sql
-- File: sql/migrate-assessment-to-module-progress.sql
-- This creates module progress for all passed assessments
```

## Step 4: Check RLS Policies

The client portal needs to read `student_module_progress`. Check policies:

```sql
-- Check existing policies
SELECT * FROM pg_policies WHERE tablename = 'student_module_progress';

-- If no SELECT policy for clients, create one:
CREATE POLICY "Clients can view student module progress"
ON student_module_progress
FOR SELECT
TO authenticated
USING (true);
```

## Step 5: Verify in Browser Console

After running the SQL scripts, refresh the client portal and check console:

Should see:
```
Module progress records: 13  (or however many total records)
Sample progress record: {student_id: "...", module_id: "...", status: "completed"}
James: 3/7 modules (3 total progress records)
Josiah: 7/7 modules (7 total progress records)
```

## Quick Fix Commands:

### Option A: Full Reset (Nuclear Option)
```sql
-- Delete ALL module progress
DELETE FROM student_module_progress;

-- Recreate from passed assessments only
-- Run: sql/migrate-assessment-to-module-progress.sql STEP 2
```

### Option B: Surgical Fix
```sql
-- Delete only failed assessment progress
-- Run: sql/cleanup-failed-module-progress.sql STEP 2

-- Add missing passed assessment progress  
-- Run: sql/migrate-assessment-to-module-progress.sql STEP 2
```

## Expected Final State:

- **James**: 3 passed assessments → 3 completed modules → Shows "3/7"
- **Josiah**: 7 passed assessments → 7 completed modules → Shows "7/7"
- **Console**: "Module progress records: 13" (or total count)
