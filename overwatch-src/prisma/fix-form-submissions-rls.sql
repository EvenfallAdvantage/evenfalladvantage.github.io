-- Fix form_submissions RLS: allow company managers/admins to view all submissions
-- Currently only the submitter can see their own submissions, blocking the Personnel Reports tab

-- Drop the restrictive select policy
DROP POLICY IF EXISTS "form_submissions_select" ON form_submissions;

-- New policy: users can see their own submissions OR all submissions for forms in their company
CREATE POLICY "form_submissions_select" ON form_submissions FOR SELECT TO authenticated
  USING (
    -- Own submissions
    user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text)
    OR
    -- Company member can see all submissions for company forms
    form_id IN (
      SELECT f.id FROM forms f
      INNER JOIN company_memberships cm ON cm.company_id = f.company_id
      INNER JOIN users u ON u.id = cm.user_id
      WHERE u.supabase_id = auth.uid()::text
    )
  );

-- Also fix update policy so admins can mark submissions as reviewed
DROP POLICY IF EXISTS "form_submissions_update" ON form_submissions;

CREATE POLICY "form_submissions_update" ON form_submissions FOR UPDATE TO authenticated
  USING (
    -- Own submissions (submitter can edit)
    user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text)
    OR
    -- Company member can update (review) submissions for company forms
    form_id IN (
      SELECT f.id FROM forms f
      INNER JOIN company_memberships cm ON cm.company_id = f.company_id
      INNER JOIN users u ON u.id = cm.user_id
      WHERE u.supabase_id = auth.uid()::text
    )
  );
