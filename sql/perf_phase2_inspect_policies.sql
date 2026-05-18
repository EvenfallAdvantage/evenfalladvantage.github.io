-- Diagnostic ONLY. Run this in Supabase SQL editor on the Overwatch DB,
-- then paste the entire result back. This is the source-of-truth for
-- what each flagged RLS policy currently looks like, so the rewrite to
-- (SELECT auth.uid()) can be done with confidence rather than guessing.

SELECT
  tablename,
  policyname,
  cmd,
  array_to_string(roles, ',') AS roles,
  qual AS using_expr,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    qual ILIKE '%auth.uid()%'
    OR qual ILIKE '%auth.role()%'
    OR qual ILIKE '%auth.jwt()%'
    OR qual ILIKE '%current_setting(%'
    OR with_check ILIKE '%auth.uid()%'
    OR with_check ILIKE '%auth.role()%'
    OR with_check ILIKE '%auth.jwt()%'
    OR with_check ILIKE '%current_setting(%'
  )
ORDER BY tablename, policyname;
