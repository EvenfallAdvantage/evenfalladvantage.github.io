# Database Cleanup Guide

## Problem: Duplicate Assessment Results

Due to a bug in the `saveAssessmentResult` function, duplicate assessment results were being created every time progress was saved. This has been fixed, but existing duplicates need to be cleaned up.

## Check for Duplicates (All Students)

### Option 1: Using Supabase SQL Editor

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Open `sql/check-duplicates.sql`
3. Run the queries to see:
   - Summary by student
   - Detailed duplicate groups
   - Total statistics
   - Worst offenders

### Option 2: Using JavaScript Console

See "Solution" section below.

## Solution

### Step 1: Load the Cleanup Script

1. Open the **Admin Dashboard** in your browser
2. Open **Developer Console** (F12)
3. Run this command to load the cleanup script:

```javascript
const script = document.createElement('script');
script.src = '/admin/js/db-cleanup.js';
document.head.appendChild(script);
```

### Step 2: Run the Cleanup

Once the script is loaded, run:

```javascript
cleanupDuplicateAssessmentResults()
```

This will:
1. ✅ Find all duplicate assessment results (same student + assessment)
2. ✅ Keep only the **best score** for each student/assessment
3. ✅ Delete all other duplicates
4. ✅ Show you a summary before deleting (requires confirmation)

### What Gets Kept

For each student/assessment combination:
- **Keeps:** The attempt with the highest score (most recent if tied)
- **Deletes:** All other attempts

### Example

If a student took "Module 1: Security Radio Communications" 5 times:
- Attempt 1: 60% (deleted)
- Attempt 2: 75% (deleted)
- Attempt 3: 90% ✅ **KEPT**
- Attempt 4: 85% (deleted)
- Attempt 5: 90% (deleted - older than attempt 3)

## Prevention

The bug has been fixed in `supabase-config.js`:
- Now checks if a result exists before inserting
- Only saves if it's a new attempt OR a better score
- Prevents future duplicates

## Cleanup Methods

### Method 1: JavaScript Console (Recommended for Single Student)

Use the JavaScript cleanup script as described above. Best for testing or cleaning up one student at a time.

### Method 2: SQL Script (Recommended for All Students)

**⚠️ IMPORTANT: This affects ALL students in the database!**

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Open `sql/cleanup-duplicates.sql`
3. **STEP 1:** Run the preview query to see what will be deleted
4. **STEP 2:** Run the count query to see totals
5. **STEP 3:** Review the results carefully
6. **STEP 4:** Uncomment and run the DELETE query
7. **STEP 5:** Run the verification query

The SQL script will:
- Keep the **best score** for each student/assessment
- Keep the **most recent** if scores are tied
- Delete all other duplicates

## Verification

After cleanup, verify by running in SQL Editor:

```sql
SELECT 
    s.email,
    COUNT(DISTINCT ar.assessment_id) as unique_assessments,
    COUNT(*) as total_records
FROM assessment_results ar
JOIN students s ON ar.student_id = s.id
GROUP BY s.email
ORDER BY s.email;
```

For each student, `unique_assessments` should equal `total_records` (no duplicates).
