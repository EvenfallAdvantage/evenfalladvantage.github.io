-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  ADD CLIENT ROLE — May 15, 2026                                  ║
-- ║                                                                   ║
-- ║  The client portal feature was shipped client-side (5 pages       ║
-- ║  under /client/*, ClientShell, db-client-portal.ts) but the       ║
-- ║  matching enum value was never added to the database. Postgres    ║
-- ║  rejects queries like `WHERE role = 'client'` with:               ║
-- ║                                                                   ║
-- ║     invalid input value for enum "CompanyRole": "client"          ║
-- ║                                                                   ║
-- ║  This migration:                                                  ║
-- ║    1. Adds 'client' to the CompanyRole enum (lowest privilege)   ║
-- ║    2. Updates update_member_role RPC to accept the new value     ║
-- ║    3. Reloads PostgREST schema cache                              ║
-- ║                                                                   ║
-- ║  Run in Supabase SQL Editor (Overwatch DB).                       ║
-- ║                                                                   ║
-- ║  Idempotent — safe to re-run.                                     ║
-- ║                                                                   ║
-- ║  Important: ALTER TYPE ADD VALUE may need to run outside a        ║
-- ║  transaction depending on Postgres version. If the SQL Editor    ║
-- ║  wraps it, run each section as a separate statement.              ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ─── 1. Add 'client' to the CompanyRole enum ──────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'client'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'CompanyRole')
  ) THEN
    -- Client is the lowest privilege role — append it after 'staff'.
    -- All client-facing pages check `isClientRole()`, not ordinal position.
    ALTER TYPE "CompanyRole" ADD VALUE 'client';
  END IF;
END $$;

-- ─── 2. Update update_member_role RPC to accept 'client' ──────────
-- Mirrors the pattern from add-instructor-role.sql. The RPC has a
-- hardcoded role allowlist that would reject any promotion to 'client'
-- otherwise.

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
  -- Validate role (now includes 'client')
  IF p_new_role NOT IN ('owner', 'admin', 'instructor', 'manager', 'lead', 'breaker', 'staff', 'client') THEN
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

  -- Only owners can promote to owner/admin/instructor; admins can set
  -- manager and below (which includes client).
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

-- ─── 3. Reload PostgREST schema cache ─────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ─── 4. Verify ─────────────────────────────────────────────────────

SELECT 'CompanyRole enum values' AS object,
       string_agg(enumlabel, ', ' ORDER BY enumsortorder) AS values
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'CompanyRole');
-- Expected: client appears in the list
