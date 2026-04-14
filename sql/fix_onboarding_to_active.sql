-- Fix converted applicants that were set to 'onboarding' instead of 'active'
-- Run this in Supabase SQL Editor to make the already-converted staff visible on the roster

UPDATE company_memberships
SET status = 'active',
    role = 'staff',
    onboarding_complete = true,
    updated_at = now()
WHERE status = 'onboarding'
  AND onboarding_complete = false;

-- Verify the fix
SELECT count(*) as updated_count FROM company_memberships WHERE status = 'active';
