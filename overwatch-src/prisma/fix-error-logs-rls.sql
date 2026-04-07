-- Fix error_logs INSERT policy: restrict to user's own errors
-- The previous WITH CHECK (true) was flagged as overly permissive

DROP POLICY IF EXISTS "Authenticated users can log errors" ON error_logs;

CREATE POLICY "Authenticated users can log errors" ON error_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id IS NULL
    OR user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text)
  );
-- Allows: inserting with user_id = own ID, or user_id = NULL (anonymous errors)
-- Blocks: inserting with a spoofed user_id belonging to another user
