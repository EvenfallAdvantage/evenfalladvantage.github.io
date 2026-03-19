-- ============================================================
-- Add instructor role + is_training_provider company flag
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Add 'instructor' to CompanyRole enum (between admin and manager)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'instructor'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'CompanyRole')
  ) THEN
    ALTER TYPE "CompanyRole" ADD VALUE 'instructor' BEFORE 'manager';
  END IF;
END $$;

-- 2. Add is_training_provider column to companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS is_training_provider BOOLEAN NOT NULL DEFAULT false;

-- 3. Set Evenfall Advantage LLC as a training provider
UPDATE public.companies
  SET is_training_provider = true
  WHERE id = '0f03bc15-aa8d-4bd3-956f-90bdd7904091';

-- 4. Update update_member_role RPC to accept 'instructor'
CREATE OR REPLACE FUNCTION public.update_member_role(
  p_membership_id UUID,
  p_new_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target RECORD;
  v_caller RECORD;
BEGIN
  -- Validate role (now includes 'instructor')
  IF p_new_role NOT IN ('owner', 'admin', 'instructor', 'manager', 'lead', 'breaker', 'staff') THEN
    RAISE EXCEPTION 'Invalid role: %', p_new_role;
  END IF;

  -- Get target membership
  SELECT * INTO v_target FROM company_memberships WHERE id = p_membership_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membership not found';
  END IF;

  -- Get caller's membership in the same company
  SELECT cm.* INTO v_caller
    FROM company_memberships cm
    JOIN users u ON u.id = cm.user_id
    WHERE u.supabase_id = auth.uid()::text
      AND cm.company_id = v_target.company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You are not a member of this company';
  END IF;

  -- Only owners can promote to owner/admin/instructor; admins can set manager and below
  IF v_caller.role = 'owner' THEN
    NULL; -- Owners can set any role
  ELSIF v_caller.role = 'admin' THEN
    IF v_target.role = 'owner' THEN
      RAISE EXCEPTION 'Admins cannot modify owner roles';
    END IF;
    IF p_new_role IN ('owner', 'admin') THEN
      RAISE EXCEPTION 'Admins cannot promote to owner or admin';
    END IF;
  ELSE
    RAISE EXCEPTION 'Only owners and admins can change roles';
  END IF;

  -- Prevent demoting the last owner
  IF v_target.role = 'owner' AND p_new_role <> 'owner' THEN
    IF (SELECT COUNT(*) FROM company_memberships WHERE company_id = v_target.company_id AND role = 'owner') <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the last owner';
    END IF;
  END IF;

  -- Perform the update
  UPDATE company_memberships SET role = p_new_role::"CompanyRole", updated_at = now()
    WHERE id = p_membership_id;

  RETURN jsonb_build_object('success', true, 'membership_id', p_membership_id, 'new_role', p_new_role);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_member_role TO authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
