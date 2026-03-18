-- ============================================================
-- FIX: Member Role Management — RPC functions (bypasses RLS)
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Update a member's role (only owner/admin of same company can do this)
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
  -- Validate role
  IF p_new_role NOT IN ('owner', 'admin', 'manager', 'staff') THEN
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

  -- Only owners can promote to owner/admin; admins can set manager/staff
  IF v_caller.role = 'owner' THEN
    -- Owners can set any role
    NULL;
  ELSIF v_caller.role = 'admin' THEN
    -- Admins cannot promote to owner or admin, and cannot change owners
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

  -- Perform the update (cast text → CompanyRole enum)
  UPDATE company_memberships SET role = p_new_role::"CompanyRole", updated_at = now()
    WHERE id = p_membership_id;

  RETURN jsonb_build_object('success', true, 'membership_id', p_membership_id, 'new_role', p_new_role);
END;
$$;

-- 2. Remove a member (only owner/admin of same company can do this)
CREATE OR REPLACE FUNCTION public.remove_company_member(
  p_membership_id UUID
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

  -- Only owners and admins can remove members
  IF v_caller.role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only owners and admins can remove members';
  END IF;

  -- Cannot remove owners (must demote first)
  IF v_target.role = 'owner' THEN
    RAISE EXCEPTION 'Cannot remove an owner. Demote them first.';
  END IF;

  -- Admins cannot remove other admins
  IF v_caller.role = 'admin' AND v_target.role = 'admin' THEN
    RAISE EXCEPTION 'Admins cannot remove other admins';
  END IF;

  -- Cannot remove yourself
  IF v_target.user_id = v_caller.user_id THEN
    RAISE EXCEPTION 'You cannot remove yourself';
  END IF;

  -- Perform the delete
  DELETE FROM company_memberships WHERE id = p_membership_id;

  RETURN jsonb_build_object('success', true, 'removed_id', p_membership_id);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.update_member_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_company_member TO authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
