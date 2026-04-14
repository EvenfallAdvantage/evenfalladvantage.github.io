-- Debug: check what statuses exist for this company
SELECT status, onboarding_complete, count(*) 
FROM company_memberships 
GROUP BY status, onboarding_complete;

-- Fix: broader update that catches null onboarding_complete too
UPDATE company_memberships
SET status = 'active',
    role = CASE WHEN role = 'member' THEN 'staff' ELSE role END,
    onboarding_complete = true,
    updated_at = now()
WHERE status != 'active'
  AND status != 'pending';

-- Verify
SELECT status, role, count(*) FROM company_memberships GROUP BY status, role;
