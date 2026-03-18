-- Fix: Allow managers/admins/owners to see all leave requests for their company
-- Currently only the requesting user can see their own rows, which blocks
-- the Personnel → Leave tab from showing team requests to managers.

-- Drop the restrictive policy
DROP POLICY IF EXISTS "time_off_requests_select" ON time_off_requests;

-- Recreate: users can see their own requests OR all requests if they are
-- a manager/admin/owner in the same company (via time_off_policies → company_id → company_memberships)
CREATE POLICY "time_off_requests_select" ON time_off_requests FOR SELECT TO authenticated
  USING (
    -- Own requests
    user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text)
    OR
    -- Manager/admin/owner in the same company
    EXISTS (
      SELECT 1
      FROM time_off_policies tp
      JOIN company_memberships cm ON cm.company_id = tp.company_id
      JOIN users u ON u.id = cm.user_id AND u.supabase_id = auth.uid()::text
      WHERE tp.id = time_off_requests.policy_id
        AND cm.role IN ('owner', 'admin', 'manager')
    )
  );
