# Database Cleanup Guide

## Problem: Duplicate Assessment Results

Due to a bug in the `saveAssessmentResult` function, duplicate assessment results were being created every time progress was saved. This has been fixed, but existing duplicates need to be cleaned up.

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

## Verification

After cleanup, you can verify by running:

```javascript
const { data } = await supabase
    .from('assessment_results')
    .select('student_id, assessment_id, score, completed_at')
    .order('student_id, assessment_id, completed_at');

console.table(data);
```

You should see only one result per student/assessment (or multiple if they're legitimate different attempts with improving scores).
