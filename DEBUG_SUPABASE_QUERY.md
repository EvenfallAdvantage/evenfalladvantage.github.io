# Debug Supabase Query Issue

## The Problem
The query returns `Array(0)` even though students and profiles exist and are linked correctly.

## Test This in Browser Console

Open the client dashboard and paste this in the browser console:

```javascript
// Test 1: Get all students (no join)
const test1 = await supabase.from('students').select('*');
console.log('Test 1 - All students:', test1);

// Test 2: Try to join student_profiles
const test2 = await supabase.from('students').select('*, student_profiles(*)');
console.log('Test 2 - With profiles:', test2);

// Test 3: Check the foreign key name in student_profiles
const test3 = await supabase.from('student_profiles').select('*').limit(1);
console.log('Test 3 - Sample profile:', test3);
```

## Expected Results

**Test 1** should show your students
**Test 2** should show students WITH their profiles
**Test 3** should show a profile with the student_id field

## If Test 2 Returns Empty Array

The foreign key relationship might not be set up in Supabase. Run this SQL:

```sql
-- Check if foreign key exists
SELECT
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'student_profiles' 
  AND tc.constraint_type = 'FOREIGN KEY';
```

This will show you the exact foreign key relationship name.
