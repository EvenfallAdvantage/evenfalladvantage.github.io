-- ============================================================================
-- Avatar Storage Diagnostic
-- Run this in Supabase SQL Editor to figure out why avatar upload is failing.
-- Each query has a comment explaining what a healthy result looks like.
-- ============================================================================

-- 1. Does the avatars bucket exist?
--    HEALTHY: one row with id='avatars', public=true, file_size_limit=5242880,
--    and allowed_mime_types includes the 4 image types.
--    BROKEN: no rows → run add-avatar-storage.sql.
SELECT id, name, public, file_size_limit, allowed_mime_types, created_at
FROM storage.buckets
WHERE id = 'avatars';

-- 2. Are the RLS policies attached to storage.objects for avatars?
--    HEALTHY: 4 policies — Users can upload/update/delete own avatars
--    + Public avatar access.
--    BROKEN: missing rows → run add-avatar-storage.sql.
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname ILIKE '%avatar%'
ORDER BY policyname;

-- 3. Is RLS enabled on storage.objects? (it should be — Supabase default)
--    HEALTHY: rowsecurity = true.
SELECT relname, relrowsecurity AS rls_enabled
FROM pg_class
WHERE relname = 'objects'
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'storage');

-- 4. Which authenticated user am I in this SQL session?
--    (Not the affected user; this just confirms your own auth context
--    when running the queries from the SQL Editor.)
SELECT auth.uid() AS my_auth_uid;

-- 5. Has anyone successfully uploaded an avatar before?
--    HEALTHY: zero or more rows depending on adoption.
--    Useful to confirm the bucket is reachable for at least one user.
SELECT name, owner, created_at
FROM storage.objects
WHERE bucket_id = 'avatars'
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================
-- INTERPRETATION
-- ----------------------------------------------------------------------------
-- Query 1 returns 0 rows  →  Bucket missing. Run add-avatar-storage.sql.
-- Query 1 ok, Query 2 returns <4 rows  →  Policies missing. Re-run the
--   policy DO $$ blocks from add-avatar-storage.sql (lines 21-50).
-- Query 1 ok, Query 2 ok, still 400 Bad Request from client
--   →  Bucket exists with wrong constraints. Check that
--      file_size_limit >= the file size and the file's MIME type is in
--      allowed_mime_types. Re-running add-avatar-storage.sql will
--      ON CONFLICT-update the constraints to the correct values.
-- ============================================================================
