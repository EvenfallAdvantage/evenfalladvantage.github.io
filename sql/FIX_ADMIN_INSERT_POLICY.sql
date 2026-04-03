-- Fix administrators INSERT policy to prevent self-promotion
-- Previously: WITH CHECK (true) allowed any authenticated user to add themselves as admin
-- Now: Only existing administrators can insert new admin records

DROP POLICY IF EXISTS "Admins can insert" ON administrators;

CREATE POLICY "Only admins can insert new admins"
  ON administrators FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM administrators)
  );

-- Note: The very first admin must be created via Supabase Dashboard or SQL Editor
-- since no admin exists yet to satisfy the policy check.
