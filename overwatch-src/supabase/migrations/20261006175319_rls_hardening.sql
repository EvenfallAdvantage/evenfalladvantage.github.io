-- =============================================================================
-- 20261006175319_rls_hardening.sql
-- Target: OverwatchDB (project nneueuvyeohwnspbwfub) ONLY.
-- Status: APPLIED to OverwatchDB on 2026-10-06 (10:53 PT) as migration
--         version 20261006175319 "rls_hardening" (PR #45). This file was
--         drafted as 20261006120000_rls_hardening.sql and renamed so the repo
--         matches supabase_migrations.schema_migrations. Apart from this header
--         comment, the SQL is byte-for-byte what was applied (md5 of the
--         applied statement = md5 of the original file,
--         651792d1ebab16458979ded05ae4aa92).
-- Rollback: supabase/migrations/rollback/20261006175319_rls_hardening.rollback.sql
--
-- Based on the LIVE definitions read on 2026-10-06 (pg_policies, pg_proc,
-- storage.buckets). Sections:
--   0. Guard and helpers (role hierarchy)
--   1. company_memberships: block self-insert / self-promotion, rank rule
--   2. timesheets: server clock, immutable fields, supervisor-only approval
--   3. join_company_by_code / create_company_with_owner: auth.uid(), real
--      rate limit, longer join codes kept in an admin-only table
--   4. Tenant isolation: companies, users, audit_logs, join_attempts
--   5. Storage: certifications, operation-maps, applicant-documents
--
-- Trusted-path technique: the guard triggers below are SECURITY INVOKER and
-- only act when current_user is 'authenticated' or 'anon' (that is, a direct
-- PostgREST write from a browser). Inside SECURITY DEFINER functions owned by
-- postgres, current_user is 'postgres', so the server-side RPCs (and the
-- service_role) keep working and do their own checks.
-- =============================================================================

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.company_memberships') IS NULL
     OR to_regclass('public.timesheets') IS NULL
     OR to_regclass('public.companies') IS NULL THEN
    RAISE EXCEPTION 'Wrong database: this migration is for OverwatchDB (nneueuvyeohwnspbwfub)';
  END IF;
END
$guard$;

-- -----------------------------------------------------------------------------
-- 0. Helpers
-- -----------------------------------------------------------------------------

-- Role hierarchy, mirrors src/lib/permissions.ts ROLE_HIERARCHY.
CREATE OR REPLACE FUNCTION public.role_rank(p_role text)
RETURNS integer
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_role
    WHEN 'owner'      THEN 60
    WHEN 'admin'      THEN 50
    WHEN 'instructor' THEN 45
    WHEN 'manager'    THEN 40
    WHEN 'lead'       THEN 30
    WHEN 'breaker'    THEN 20
    WHEN 'staff'      THEN 10
    WHEN 'client'     THEN 5
    ELSE 0
  END
$$;

-- Highest rank a caller with this role may assign:
--   owner   -> admin (50)       (everything below owner)
--   admin   -> instructor (45)  (one role below admin)
--   manager -> lead (30)        (one role below manager)
--   anyone else -> 0 (cannot assign roles)
CREATE OR REPLACE FUNCTION public.max_assignable_rank(p_caller_role text)
RETURNS integer
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_caller_role IN ('owner', 'admin', 'manager') THEN (
      SELECT max(r) FROM unnest(ARRAY[60, 50, 45, 40, 30, 20, 10, 5]) AS r
      WHERE r < public.role_rank(p_caller_role)
    )
    ELSE 0
  END
$$;

-- Caller's active role in a company (NULL when not a member).
CREATE OR REPLACE FUNCTION public.my_company_role(p_company_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT cm.role::text
  FROM public.company_memberships cm
  JOIN public.users u ON u.id = cm.user_id
  WHERE u.supabase_id = auth.uid()::text
    AND cm.company_id = p_company_id
    AND cm.status = 'active'
  LIMIT 1
$$;

-- Owner or admin of the company (company settings, join code edits, audit read).
CREATE OR REPLACE FUNCTION public.is_company_owner_admin(p_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(public.my_company_role(p_company_id) IN ('owner', 'admin'), false)
$$;

-- True when the caller shares at least one company with p_user_id.
CREATE OR REPLACE FUNCTION public.shares_company_with(p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships mine
    JOIN public.users me ON me.id = mine.user_id
    JOIN public.company_memberships theirs ON theirs.company_id = mine.company_id
    WHERE me.supabase_id = auth.uid()::text
      AND theirs.user_id = p_user_id
  )
$$;

-- Safe "first path segment as uuid" for storage paths (NULL instead of a cast error).
CREATE OR REPLACE FUNCTION public.storage_path_company(p_object_name text)
RETURNS uuid
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN split_part(p_object_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN split_part(p_object_name, '/', 1)::uuid
    ELSE NULL
  END
$$;

REVOKE ALL ON FUNCTION public.my_company_role(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_company_owner_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.shares_company_with(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_company_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_owner_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_company_with(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.role_rank(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.max_assignable_rank(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storage_path_company(text) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 1. company_memberships
-- -----------------------------------------------------------------------------
-- Design intent:
--   * Self-serve company creation stays: create_company_with_owner makes the
--     caller the owner atomically.
--   * Joining an existing company only via join_company_by_code -> 'staff'.
--   * Roles are only granted by create_roster_member / update_member_role /
--     add_client_member (definer RPCs enforcing the rank rule).
--   * A member may still edit their own profile fields (bio, sizes, etc.).

-- Direct inserts are no longer allowed (live: WITH CHECK user_id = me, any role, any company).
DROP POLICY IF EXISTS memberships_insert ON public.company_memberships;

-- Self-update keeps working for profile fields; WITH CHECK makes the row stay yours.
DROP POLICY IF EXISTS memberships_update ON public.company_memberships;
CREATE POLICY memberships_update ON public.company_memberships
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (user_id = public.get_my_user_id())
  WITH CHECK (user_id = public.get_my_user_id());

CREATE OR REPLACE FUNCTION public.guard_company_memberships()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_caller_role text;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN COALESCE(NEW, OLD);  -- trusted definer / service path
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Direct membership inserts are not allowed (use join_company_by_code, create_company_with_owner, create_roster_member or add_client_member)'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.pay_rate_override IS DISTINCT FROM OLD.pay_rate_override
       OR NEW.hire_date IS DISTINCT FROM OLD.hire_date
       OR NEW.kiosk_pin IS DISTINCT FROM OLD.kiosk_pin
       OR NEW.qr_code_id IS DISTINCT FROM OLD.qr_code_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'You cannot change role, company, pay rate, hire date, kiosk PIN or QR id on a membership'
        USING ERRCODE = '42501';
    END IF;
    -- Only allow finishing onboarding (-> active); never self-reactivate a
    -- suspended/removed membership.
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (NEW.status = 'active' AND OLD.status IN ('pending', 'onboarding', 'invited')) THEN
      RAISE EXCEPTION 'You cannot change membership status from % to %', OLD.status, NEW.status
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- DELETE (RLS already limits to owner/admin of the company)
  v_caller_role := public.my_company_role(OLD.company_id);
  IF v_caller_role IS NULL
     OR v_caller_role NOT IN ('owner', 'admin')
     OR public.role_rank(v_caller_role) <= public.role_rank(OLD.role::text) THEN
    RAISE EXCEPTION 'You can only remove members ranked below you'
      USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END
$$;

DROP TRIGGER IF EXISTS trg_guard_company_memberships ON public.company_memberships;
CREATE TRIGGER trg_guard_company_memberships
  BEFORE INSERT OR UPDATE OR DELETE ON public.company_memberships
  FOR EACH ROW EXECUTE FUNCTION public.guard_company_memberships();

-- update_member_role with the rank rule:
--   * caller must be owner/admin/manager of the target's company
--   * target must rank strictly below the caller (no peers, no superiors, no self)
--   * new role rank <= max_assignable_rank(caller): owner->admin, admin->instructor,
--     manager->lead. 'owner' can no longer be granted through this RPC.
CREATE OR REPLACE FUNCTION public.update_member_role(p_membership_id uuid, p_new_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_target RECORD;
  v_caller RECORD;
  v_caller_rank int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_new_role IS NULL OR p_new_role NOT IN ('owner', 'admin', 'instructor', 'manager', 'lead', 'breaker', 'staff', 'client') THEN
    RAISE EXCEPTION 'Invalid role: %', p_new_role;
  END IF;

  SELECT * INTO v_target FROM company_memberships WHERE id = p_membership_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membership not found';
  END IF;

  SELECT cm.* INTO v_caller
    FROM company_memberships cm
    JOIN users u ON u.id = cm.user_id
    WHERE u.supabase_id = auth.uid()::text
      AND cm.company_id = v_target.company_id
      AND cm.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'You are not a member of this company';
  END IF;

  IF v_caller.role::text NOT IN ('owner', 'admin', 'manager') THEN
    RAISE EXCEPTION 'Only owners, admins and managers can change roles' USING ERRCODE = '42501';
  END IF;

  IF v_caller.id = v_target.id THEN
    RAISE EXCEPTION 'You cannot change your own role' USING ERRCODE = '42501';
  END IF;

  v_caller_rank := role_rank(v_caller.role::text);

  IF role_rank(v_target.role::text) >= v_caller_rank THEN
    RAISE EXCEPTION 'You can only change roles of members ranked below you' USING ERRCODE = '42501';
  END IF;

  IF role_rank(p_new_role) > max_assignable_rank(v_caller.role::text) THEN
    RAISE EXCEPTION 'Role % can only assign roles up to one level below its own', v_caller.role USING ERRCODE = '42501';
  END IF;

  -- Kept from the live version (unreachable now that owners cannot be targeted,
  -- but harmless and protects against future rule changes).
  IF v_target.role = 'owner' AND p_new_role <> 'owner' THEN
    IF (SELECT COUNT(*) FROM company_memberships WHERE company_id = v_target.company_id AND role = 'owner') <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the last owner';
    END IF;
  END IF;

  UPDATE company_memberships SET role = p_new_role::"CompanyRole", updated_at = now()
    WHERE id = p_membership_id;

  RETURN jsonb_build_object('success', true, 'membership_id', p_membership_id, 'new_role', p_new_role);
END
$$;

-- create_roster_member: same body as live, plus the assignable-role rule
-- (live allowed a manager to add someone as 'owner').
CREATE OR REPLACE FUNCTION public.create_roster_member(p_company_id uuid, p_first_name text, p_last_name text, p_email text, p_phone text DEFAULT NULL::text, p_role text DEFAULT 'staff'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_caller_supabase_id text;
  v_caller_role        text;
  v_user_id            uuid;
  v_existing_user      boolean := false;
  v_membership_id      uuid;
  v_email_norm         text;
  v_resolved_first     text;
  v_resolved_last      text;
BEGIN
  v_caller_supabase_id := auth.uid()::text;
  IF v_caller_supabase_id IS NULL OR v_caller_supabase_id = '' THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  v_caller_role := public.my_company_role(p_company_id);
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin', 'manager') THEN
    RAISE EXCEPTION 'Forbidden — owner/admin/manager required'
      USING ERRCODE = '42501';
  END IF;

  IF p_first_name IS NULL OR length(trim(p_first_name)) = 0 THEN
    RAISE EXCEPTION 'first_name is required' USING ERRCODE = '22023';
  END IF;
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RAISE EXCEPTION 'email is required' USING ERRCODE = '22023';
  END IF;
  IF p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'email is not a valid address' USING ERRCODE = '22023';
  END IF;
  IF p_role IS NULL OR p_role NOT IN (
    'owner', 'admin', 'instructor', 'manager', 'lead', 'breaker', 'staff', 'client'
  ) THEN
    RAISE EXCEPTION 'invalid role: %', p_role USING ERRCODE = '22023';
  END IF;
  -- NEW: rank rule (owner->admin max, admin->instructor max, manager->lead max)
  IF public.role_rank(p_role) > public.max_assignable_rank(v_caller_role) THEN
    RAISE EXCEPTION 'Role % can only add members with roles up to one level below its own', v_caller_role
      USING ERRCODE = '42501';
  END IF;

  v_email_norm := lower(trim(p_email));

  SELECT id, first_name, last_name
    INTO v_user_id, v_resolved_first, v_resolved_last
  FROM public.users
  WHERE lower(email) = v_email_norm
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    v_existing_user := true;
  ELSE
    v_user_id := gen_random_uuid();
    v_resolved_first := trim(p_first_name);
    v_resolved_last  := COALESCE(trim(p_last_name), '');
    INSERT INTO public.users (
      id, email, first_name, last_name, phone,
      supabase_id, created_at, updated_at
    ) VALUES (
      v_user_id, v_email_norm, v_resolved_first, v_resolved_last,
      NULLIF(trim(p_phone), ''), NULL, now(), now()
    );
  END IF;

  INSERT INTO public.company_memberships (
    id, user_id, company_id, role, status,
    work_preferences, notification_days,
    created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_user_id, p_company_id,
    p_role::public."CompanyRole",
    'active',
    ARRAY[]::text[],
    ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun']::text[],
    now(), now()
  )
  ON CONFLICT (user_id, company_id) DO UPDATE
    SET status = 'active',
        updated_at = now()
  RETURNING id INTO v_membership_id;

  RETURN jsonb_build_object(
    'user_id',        v_user_id,
    'membership_id',  v_membership_id,
    'existing_user',  v_existing_user,
    'first_name',     v_resolved_first,
    'last_name',      v_resolved_last
  );
END;
$function$;

-- Replaces the client-side insert in db-client-portal.ts addClientMember
-- (that insert was already denied by the live memberships_insert policy).
CREATE OR REPLACE FUNCTION public.add_client_member(p_company_id uuid, p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_role text;
  v_user_id uuid;
  v_existing text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  v_caller_role := public.my_company_role(p_company_id);
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin', 'manager') THEN
    RAISE EXCEPTION 'Forbidden — owner/admin/manager required' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_user_id FROM public.users WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No user found with that email. They need to create an account first.');
  END IF;

  SELECT role::text INTO v_existing FROM public.company_memberships
    WHERE company_id = p_company_id AND user_id = v_user_id;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', format('This user is already a %s in your organization.', v_existing));
  END IF;

  INSERT INTO public.company_memberships (id, user_id, company_id, role, status, created_at, updated_at)
  VALUES (gen_random_uuid(), v_user_id, p_company_id, 'client'::public."CompanyRole", 'active', now(), now());

  RETURN jsonb_build_object('success', true);
END
$$;

-- Replaces the client-side update in db-pay.ts updateMemberPayRate
-- (that update was a silent no-op under the live self-only policy).
CREATE OR REPLACE FUNCTION public.set_member_pay_rate(p_membership_id uuid, p_pay_rate numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_target public.company_memberships%ROWTYPE;
  v_caller_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_target FROM public.company_memberships WHERE id = p_membership_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membership not found';
  END IF;
  v_caller_role := public.my_company_role(v_target.company_id);
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin', 'manager') THEN
    RAISE EXCEPTION 'Forbidden — owner/admin/manager required' USING ERRCODE = '42501';
  END IF;
  -- Same hierarchy as roles: only for members ranked below you. Owners may
  -- also set their own rate.
  IF public.role_rank(v_target.role::text) >= public.role_rank(v_caller_role)
     AND NOT (v_caller_role = 'owner' AND v_target.user_id = public.get_my_user_id()) THEN
    RAISE EXCEPTION 'You can only set pay rates for members ranked below you' USING ERRCODE = '42501';
  END IF;
  IF p_pay_rate IS NOT NULL AND (p_pay_rate < 0 OR p_pay_rate > 10000) THEN
    RAISE EXCEPTION 'Invalid pay rate' USING ERRCODE = '22023';
  END IF;
  UPDATE public.company_memberships
     SET pay_rate_override = p_pay_rate, updated_at = now()
   WHERE id = p_membership_id;
END
$$;

REVOKE ALL ON FUNCTION public.add_client_member(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_member_pay_rate(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_client_member(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_member_pay_rate(uuid, numeric) TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. timesheets
-- -----------------------------------------------------------------------------
-- Supervisor = owner/admin/manager of the row's company (matches the live
-- timesheets_admin_* and managers_* policies). For the 28 legacy rows with a
-- NULL company_id, any company where the caller supervises the row's user.
CREATE OR REPLACE FUNCTION public.can_supervise_timesheet(p_user_id uuid, p_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships sup
    JOIN public.users me ON me.id = sup.user_id
    JOIN public.company_memberships target ON target.company_id = sup.company_id
    WHERE me.supabase_id = auth.uid()::text
      AND sup.status = 'active'
      AND sup.role IN ('owner', 'admin', 'manager')
      AND target.user_id = p_user_id
      AND (p_company_id IS NULL OR sup.company_id = p_company_id)
  )
$$;
REVOKE ALL ON FUNCTION public.can_supervise_timesheet(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_supervise_timesheet(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_timesheets()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_me  uuid;
  v_now timestamp := (now() AT TIME ZONE 'utc');  -- clock_in/out are UTC wall time
  v_sup boolean;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_me := public.get_my_user_id();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Supervisor rights apply to other people's rows. On your own row you get
  -- staff rules, except a company owner (single-owner companies need to fix
  -- their own entries; flagged in the PR).
  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id = v_me THEN
      v_sup := COALESCE(public.my_company_role(NEW.company_id) = 'owner', false);
    ELSE
      v_sup := public.can_supervise_timesheet(NEW.user_id, NEW.company_id);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.user_id = v_me THEN
      v_sup := COALESCE(public.my_company_role(OLD.company_id) = 'owner', false)
               AND NEW.company_id IS NOT DISTINCT FROM OLD.company_id;
    ELSE
      v_sup := public.can_supervise_timesheet(OLD.user_id, OLD.company_id)
               AND public.can_supervise_timesheet(NEW.user_id, NEW.company_id);
    END IF;
  ELSE
    IF OLD.user_id = v_me THEN
      v_sup := COALESCE(public.my_company_role(OLD.company_id) = 'owner', false);
    ELSE
      v_sup := public.can_supervise_timesheet(OLD.user_id, OLD.company_id);
    END IF;
  END IF;

  v_sup := COALESCE(v_sup, false);  -- never let a NULL skip the staff rules

  IF TG_OP = 'DELETE' THEN
    IF NOT v_sup THEN
      RAISE EXCEPTION 'Only a supervisor can delete timesheets' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id <> v_me AND NOT v_sup THEN
      RAISE EXCEPTION 'You can only create timesheets for members you supervise' USING ERRCODE = '42501';
    END IF;
    IF NOT v_sup THEN
      -- Staff clock-in: server time, nothing pre-approved.
      IF NEW.company_id IS NOT NULL AND public.my_company_role(NEW.company_id) IS NULL THEN
        RAISE EXCEPTION 'You are not a member of that company' USING ERRCODE = '42501';
      END IF;
      NEW.clock_in      := v_now;
      NEW.clock_out     := NULL;
      NEW.break_minutes := 0;
      NEW.qb_synced     := false;
    END IF;
    -- Nobody inserts a pre-approved row; approval is a separate supervisor step.
    NEW.approved       := false;
    NEW.approved_by_id := NULL;
    NEW.approved_at    := NULL;
    NEW.created_at     := v_now;
    NEW.updated_at     := v_now;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'id, user_id and created_at are immutable' USING ERRCODE = '42501';
  END IF;

  IF NOT v_sup THEN
    IF NEW.clock_in IS DISTINCT FROM OLD.clock_in
       OR NEW.approved IS DISTINCT FROM OLD.approved
       OR NEW.approved_by_id IS DISTINCT FROM OLD.approved_by_id
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.break_minutes IS DISTINCT FROM OLD.break_minutes
       OR NEW.qb_synced IS DISTINCT FROM OLD.qb_synced
       OR NEW.clock_method IS DISTINCT FROM OLD.clock_method
       OR NEW.clock_in_type IS DISTINCT FROM OLD.clock_in_type
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.shift_id IS DISTINCT FROM OLD.shift_id
       OR NEW.event_id IS DISTINCT FROM OLD.event_id THEN
      RAISE EXCEPTION 'Only a supervisor can edit clock-in, approval or assignment fields (use a time change request)'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.clock_out IS DISTINCT FROM OLD.clock_out THEN
      IF OLD.clock_out IS NOT NULL THEN
        RAISE EXCEPTION 'This timesheet is already clocked out; use a time change request'
          USING ERRCODE = '42501';
      END IF;
      NEW.clock_out := v_now;  -- clock-out uses server time; client value ignored
    END IF;
    NEW.updated_at := v_now;
    RETURN NEW;
  END IF;

  -- Supervisor update: may correct times; approval metadata is stamped by the server.
  IF NEW.approved IS DISTINCT FROM OLD.approved THEN
    IF NEW.approved THEN
      NEW.approved_by_id := v_me;
      NEW.approved_at    := v_now;
    ELSE
      NEW.approved_by_id := NULL;
      NEW.approved_at    := NULL;
    END IF;
  ELSE
    NEW.approved_by_id := OLD.approved_by_id;
    NEW.approved_at    := OLD.approved_at;
  END IF;
  NEW.updated_at := v_now;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_guard_timesheets ON public.timesheets;
CREATE TRIGGER trg_guard_timesheets
  BEFORE INSERT OR UPDATE OR DELETE ON public.timesheets
  FOR EACH ROW EXECUTE FUNCTION public.guard_timesheets();

-- Staff could delete their own timesheets (live timesheets_delete). Deleting
-- is a supervisor action (managers_delete_timesheets stays).
DROP POLICY IF EXISTS timesheets_delete ON public.timesheets;

-- Self-update keeps working (clock-out, notes); row must stay yours.
DROP POLICY IF EXISTS timesheets_update ON public.timesheets;
CREATE POLICY timesheets_update ON public.timesheets
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (user_id = public.get_my_user_id())
  WITH CHECK (user_id = public.get_my_user_id());

-- -----------------------------------------------------------------------------
-- 3. Join codes, join_company_by_code, create_company_with_owner
-- -----------------------------------------------------------------------------
-- Join codes move to an admin-only table. companies stays readable by every
-- authenticated user (companies_select = true is used by intake shares and
-- job postings), so the old companies.join_code column is overwritten with an
-- unguessable lowercase placeholder that can never match (lookups uppercase
-- the input). Existing 6-char codes are copied over and stay valid.

CREATE TABLE IF NOT EXISTS public.company_join_codes (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  code       text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz
);
ALTER TABLE public.company_join_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_join_codes FROM PUBLIC, anon, authenticated;
-- No policies: only SECURITY DEFINER functions and service_role touch it.

INSERT INTO public.company_join_codes (company_id, code)
SELECT id, upper(trim(join_code))
FROM public.companies
WHERE join_code IS NOT NULL
  AND join_code !~ '^x[0-9a-f]{32}$'
ON CONFLICT (company_id) DO NOTHING;

UPDATE public.companies
   SET join_code = 'x' || encode(extensions.gen_random_bytes(16), 'hex')
 WHERE join_code !~ '^x[0-9a-f]{32}$';

-- 10 chars from a 32-symbol alphabet without 0/O/1/I (32^10 ~ 1.1e15).
-- 256 % 32 = 0, so "byte % 32" is unbiased.
CREATE OR REPLACE FUNCTION public.generate_join_code(p_length integer DEFAULT 10)
RETURNS text
LANGUAGE plpgsql VOLATILE
SET search_path = ''
AS $$
DECLARE
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(p_length);
  v_code text := '';
  i int;
BEGIN
  FOR i IN 0 .. p_length - 1 LOOP
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  END LOOP;
  RETURN v_code;
END
$$;
REVOKE ALL ON FUNCTION public.generate_join_code(integer) FROM PUBLIC, anon, authenticated;

-- Join attempts: users could insert and DELETE their own rows (deleting
-- resets the limit). Only the definer RPC writes them now.
DROP POLICY IF EXISTS join_attempts_insert ON public.join_attempts;
DROP POLICY IF EXISTS join_attempts_delete ON public.join_attempts;

-- Email for the users row comes from auth.users, not the caller. Otherwise a
-- caller could claim an email that create_roster_member later matches.
CREATE OR REPLACE FUNCTION public.join_company_by_code(p_join_code text, p_supabase_id text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_first_name text DEFAULT ''::text, p_last_name text DEFAULT ''::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid text;
  v_auth_email text;
  v_company RECORD;
  v_user RECORD;
  v_membership RECORD;
  v_phone TEXT;
  v_code TEXT;
  v_recent INT;
  v_daily INT;
BEGIN
  v_uid := auth.uid()::text;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  -- p_supabase_id is kept for frontend compatibility but must be you.
  IF p_supabase_id IS NOT NULL AND p_supabase_id <> v_uid THEN
    RAISE EXCEPTION 'p_supabase_id does not match the signed-in user' USING ERRCODE = '42501';
  END IF;

  -- Rate limit keyed on auth.uid(): 5 per 15 minutes, 20 per 24 hours.
  -- Serialize per user so parallel requests cannot all pass the count.
  PERFORM pg_advisory_xact_lock(hashtextextended('join_company_by_code:' || v_uid, 0));
  DELETE FROM public.join_attempts
    WHERE supabase_id = v_uid AND attempted_at < now() - interval '24 hours';
  SELECT count(*) FILTER (WHERE attempted_at > now() - interval '15 minutes'),
         count(*)
    INTO v_recent, v_daily
    FROM public.join_attempts
    WHERE supabase_id = v_uid;
  IF v_recent >= 5 THEN
    RAISE EXCEPTION 'Too many join attempts. Please wait 15 minutes and try again.';
  END IF;
  IF v_daily >= 20 THEN
    RAISE EXCEPTION 'Too many join attempts today. Please try again tomorrow or ask your admin for an invite.';
  END IF;
  INSERT INTO public.join_attempts (supabase_id) VALUES (v_uid);

  -- 1. Find company by join code. An invalid code RETURNS an error object
  --    instead of raising: raising would roll back the join_attempts row
  --    above, which is why the live rate limit never counted failures.
  v_code := upper(regexp_replace(COALESCE(p_join_code, ''), '\s', '', 'g'));
  SELECT c.* INTO v_company
    FROM public.company_join_codes j
    JOIN public.companies c ON c.id = j.company_id
    WHERE j.code = v_code;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invalid company code');
  END IF;

  v_phone := NULLIF(TRIM(COALESCE(p_phone, '')), '');
  SELECT NULLIF(lower(trim(email)), '') INTO v_auth_email FROM auth.users WHERE id = v_uid::uuid;

  -- 2. Find or create user (keyed on auth.uid())
  SELECT * INTO v_user FROM public.users WHERE supabase_id = v_uid;
  IF NOT FOUND THEN
    INSERT INTO public.users (id, supabase_id, email, phone, first_name, last_name, created_at, updated_at)
    VALUES (
      gen_random_uuid(), v_uid, v_auth_email, v_phone,
      COALESCE(NULLIF(TRIM(p_first_name), ''), 'User'),
      COALESCE(NULLIF(TRIM(p_last_name), ''), ''),
      now(), now()
    )
    RETURNING * INTO v_user;
  ELSE
    UPDATE public.users SET
      email = COALESCE(v_auth_email, email),
      phone = COALESCE(v_phone, phone),
      first_name = CASE WHEN TRIM(p_first_name) <> '' THEN p_first_name ELSE first_name END,
      last_name = CASE WHEN TRIM(p_last_name) <> '' THEN p_last_name ELSE last_name END,
      updated_at = now()
    WHERE id = v_user.id
    RETURNING * INTO v_user;
  END IF;

  -- 3. Membership: always the default low role; an existing membership is
  --    returned unchanged (never upgraded or reactivated by a code).
  SELECT * INTO v_membership
    FROM public.company_memberships
    WHERE user_id = v_user.id AND company_id = v_company.id;
  IF NOT FOUND THEN
    INSERT INTO public.company_memberships (
      id, user_id, company_id, role, status,
      work_preferences, notification_days, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_user.id, v_company.id, 'staff', 'active',
      '{}'::text[], ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun']::text[],
      now(), now()
    )
    RETURNING * INTO v_membership;
  END IF;

  RETURN jsonb_build_object(
    'user', jsonb_build_object(
      'id', v_user.id, 'supabase_id', v_user.supabase_id, 'email', v_user.email,
      'phone', v_user.phone, 'first_name', v_user.first_name, 'last_name', v_user.last_name
    ),
    'company', jsonb_build_object(
      'id', v_company.id, 'name', v_company.name, 'slug', v_company.slug
    ),
    'membership', jsonb_build_object(
      'id', v_membership.id, 'role', v_membership.role, 'status', v_membership.status
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_company_with_owner(p_company_name text, p_supabase_id text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_first_name text DEFAULT ''::text, p_last_name text DEFAULT ''::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid text;
  v_auth_email text;
  v_company RECORD;
  v_user RECORD;
  v_membership RECORD;
  v_slug TEXT;
  v_base_slug TEXT;
  v_join_code TEXT;
  v_attempt INT := 0;
  v_created_today INT;
BEGIN
  v_uid := auth.uid()::text;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_supabase_id IS NOT NULL AND p_supabase_id <> v_uid THEN
    RAISE EXCEPTION 'p_supabase_id does not match the signed-in user' USING ERRCODE = '42501';
  END IF;
  IF p_company_name IS NULL OR length(trim(p_company_name)) = 0 OR length(trim(p_company_name)) > 120 THEN
    RAISE EXCEPTION 'Company name must be 1-120 characters' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('create_company_with_owner:' || v_uid, 0));
  v_auth_email := (SELECT NULLIF(lower(trim(email)), '') FROM auth.users WHERE id = v_uid::uuid);

  -- 1. Find or create user (keyed on auth.uid())
  SELECT * INTO v_user FROM users WHERE supabase_id = v_uid;
  IF NOT FOUND THEN
    INSERT INTO users (id, supabase_id, email, phone, first_name, last_name, created_at, updated_at)
    VALUES (
      gen_random_uuid(), v_uid, v_auth_email, NULLIF(TRIM(COALESCE(p_phone, '')), ''),
      COALESCE(NULLIF(TRIM(p_first_name), ''), 'User'),
      COALESCE(NULLIF(TRIM(p_last_name), ''), ''),
      now(), now()
    )
    RETURNING * INTO v_user;
  ELSE
    -- Rate limit: at most 3 new companies owned per user per 24 hours.
    SELECT count(*) INTO v_created_today
      FROM company_memberships cm
      JOIN companies c ON c.id = cm.company_id
      WHERE cm.user_id = v_user.id AND cm.role = 'owner'
        AND c.created_at > (now() AT TIME ZONE 'utc') - interval '24 hours';
    IF v_created_today >= 3 THEN
      RAISE EXCEPTION 'Too many companies created today. Please try again tomorrow.';
    END IF;

    UPDATE users SET
      email = COALESCE(v_auth_email, email),
      phone = COALESCE(NULLIF(TRIM(p_phone), ''), phone),
      first_name = CASE WHEN TRIM(p_first_name) <> '' THEN p_first_name ELSE first_name END,
      last_name = CASE WHEN TRIM(p_last_name) <> '' THEN p_last_name ELSE last_name END,
      updated_at = now()
    WHERE id = v_user.id
    RETURNING * INTO v_user;
  END IF;

  -- 2. Company with slug collision handling (as live). companies.join_code
  --    gets a placeholder; the real code lives in company_join_codes.
  v_base_slug := lower(regexp_replace(trim(p_company_name), '[^a-z0-9]+', '-', 'gi'));
  v_base_slug := trim(both '-' from v_base_slug);
  IF v_base_slug = '' THEN
    v_base_slug := 'company';
  END IF;
  v_slug := v_base_slug;

  LOOP
    BEGIN
      INSERT INTO companies (id, name, slug, join_code, brand_color, timezone, settings, created_at, updated_at)
      VALUES (
        gen_random_uuid(), trim(p_company_name), v_slug,
        'x' || encode(extensions.gen_random_bytes(16), 'hex'),
        '#1d3451', 'America/Los_Angeles', '{}'::jsonb, now(), now()
      )
      RETURNING * INTO v_company;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      v_attempt := v_attempt + 1;
      IF v_attempt > 10 THEN
        RAISE EXCEPTION 'Could not create company: too many slug collisions';
      END IF;
      v_slug := v_base_slug || '-' || substr(md5(random()::text), 1, 4);
    END;
  END LOOP;

  v_attempt := 0;
  LOOP
    BEGIN
      v_join_code := public.generate_join_code(10);
      INSERT INTO public.company_join_codes (company_id, code) VALUES (v_company.id, v_join_code);
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      v_attempt := v_attempt + 1;
      IF v_attempt > 10 THEN
        RAISE EXCEPTION 'Could not generate a unique join code';
      END IF;
    END;
  END LOOP;

  -- 3. Owner membership (atomic with the company insert)
  INSERT INTO company_memberships (
    id, user_id, company_id, role, status,
    work_preferences, notification_days, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_user.id, v_company.id, 'owner', 'active',
    '{}'::text[], ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun']::text[],
    now(), now()
  )
  RETURNING * INTO v_membership;

  RETURN jsonb_build_object(
    'user', jsonb_build_object(
      'id', v_user.id, 'supabase_id', v_user.supabase_id, 'email', v_user.email,
      'phone', v_user.phone, 'first_name', v_user.first_name, 'last_name', v_user.last_name
    ),
    'company', jsonb_build_object(
      'id', v_company.id, 'name', v_company.name, 'slug', v_company.slug,
      'join_code', v_join_code
    ),
    'membership', jsonb_build_object(
      'id', v_membership.id, 'role', v_membership.role, 'status', v_membership.status
    )
  );
END;
$function$;

-- Read the join code: owner/admin/manager (managers onboard staff).
CREATE OR REPLACE FUNCTION public.get_company_join_code(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(public.my_company_role(p_company_id), '') NOT IN ('owner', 'admin', 'manager') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT code FROM public.company_join_codes WHERE company_id = p_company_id);
END
$$;

-- Rotate (edit) the join code: owner/admin only. Invalidates the old code.
CREATE OR REPLACE FUNCTION public.rotate_company_join_code(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_code text;
  v_attempt int := 0;
BEGIN
  IF NOT public.is_company_owner_admin(p_company_id) THEN
    RAISE EXCEPTION 'Forbidden — owner/admin required' USING ERRCODE = '42501';
  END IF;
  LOOP
    BEGIN
      v_code := public.generate_join_code(10);
      INSERT INTO public.company_join_codes (company_id, code, rotated_at)
      VALUES (p_company_id, v_code, now())
      ON CONFLICT (company_id) DO UPDATE SET code = EXCLUDED.code, rotated_at = now();
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      v_attempt := v_attempt + 1;
      IF v_attempt > 10 THEN RAISE EXCEPTION 'Could not generate a unique join code'; END IF;
    END;
  END LOOP;
  RETURN v_code;
END
$$;

REVOKE ALL ON FUNCTION public.join_company_by_code(text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_company_with_owner(text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_company_join_code(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rotate_company_join_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_company_by_code(text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_company_with_owner(text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_join_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_company_join_code(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. Tenant isolation
-- -----------------------------------------------------------------------------

-- 4a. companies: settings/branding edits are owner/admin only (live: any member).
DROP POLICY IF EXISTS companies_update ON public.companies;
CREATE POLICY companies_update ON public.companies
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_company_owner_admin(id))
  WITH CHECK (public.is_company_owner_admin(id));

-- Direct company inserts created owner-less companies with a caller-chosen
-- join code. Creation goes through create_company_with_owner only.
DROP POLICY IF EXISTS companies_insert ON public.companies;

-- The radio channel state is written by any member (db-radio.ts); keep that
-- one field writable for members through a narrow RPC.
CREATE OR REPLACE FUNCTION public.set_company_radio_state(p_company_id uuid, p_state text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.my_company_role(p_company_id) IS NULL THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_state IS NOT NULL AND length(p_state) > 20000 THEN
    RAISE EXCEPTION 'radio state too large' USING ERRCODE = '22023';
  END IF;
  UPDATE public.companies SET radio_state = p_state WHERE id = p_company_id;
END
$$;
REVOKE ALL ON FUNCTION public.set_company_radio_state(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_company_radio_state(uuid, text) TO authenticated;

-- 4b. users: only yourself and people who share a company with you (live: everyone).
DROP POLICY IF EXISTS users_select ON public.users;
CREATE POLICY users_select ON public.users
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (supabase_id = auth.uid()::text OR public.shares_company_with(id));

DROP POLICY IF EXISTS users_update ON public.users;
CREATE POLICY users_update ON public.users
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (supabase_id = auth.uid()::text)
  WITH CHECK (supabase_id = auth.uid()::text);

CREATE OR REPLACE FUNCTION public.guard_users()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_auth_email text;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  v_auth_email := lower(NULLIF(auth.jwt() ->> 'email', ''));

  IF TG_OP = 'INSERT' THEN
    NEW.is_platform_admin := false;
    IF NEW.email IS NOT NULL AND lower(NEW.email) IS DISTINCT FROM v_auth_email THEN
      RAISE EXCEPTION 'users.email must match your sign-in email' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.supabase_id IS DISTINCT FROM OLD.supabase_id
     OR NEW.is_platform_admin IS DISTINCT FROM OLD.is_platform_admin
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'id, supabase_id, is_platform_admin and created_at cannot be changed'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email
     AND NEW.email IS NOT NULL
     AND lower(NEW.email) IS DISTINCT FROM v_auth_email THEN
    RAISE EXCEPTION 'users.email must match your sign-in email' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_guard_users ON public.users;
CREATE TRIGGER trg_guard_users
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_users();

-- 4c. audit_logs: insert-only through log_audit_event(), read-only for
-- owners/admins. Live: any member could insert, update and read; any
-- owner/admin/manager could delete; the "Admins can read" policy compared
-- users.id with auth.uid() and never matched.
DROP POLICY IF EXISTS "Admins can read company audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can insert own audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_delete ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_select ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_update ON public.audit_logs;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM anon, authenticated;

CREATE POLICY audit_logs_admin_select ON public.audit_logs
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_company_owner_admin(company_id));

-- Fixes the login logging bug: the client skipped every event without a
-- company_id (all login events), sent no id (column has no default) and sent
-- the auth uid as users.id. The server now derives the user, generates the
-- id and fans out to each of the caller's companies when none is given.
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_event_type  text,
  p_outcome     text,
  p_company_id  uuid  DEFAULT NULL,
  p_metadata    jsonb DEFAULT '{}'::jsonb,
  p_user_agent  text  DEFAULT NULL,
  p_entity_type text  DEFAULT 'auth'
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_me uuid;
  v_ip text;
  v_meta jsonb := COALESCE(p_metadata, '{}'::jsonb);
  v_rows int := 0;
BEGIN
  v_me := public.get_my_user_id();
  IF v_me IS NULL THEN
    RETURN 0;  -- no session / no users row: nothing to attribute (see PR notes)
  END IF;
  IF p_event_type IS NULL OR p_event_type !~ '^[a-z0-9_.:-]{1,100}$' THEN
    RAISE EXCEPTION 'invalid event_type' USING ERRCODE = '22023';
  END IF;
  IF p_outcome IS NULL OR p_outcome NOT IN ('success', 'failure', 'blocked') THEN
    RAISE EXCEPTION 'invalid outcome' USING ERRCODE = '22023';
  END IF;
  IF length(v_meta::text) > 4000 THEN
    v_meta := jsonb_build_object('truncated', true);
  END IF;
  -- Light flood control: 60 events per user per minute.
  IF (SELECT count(*) FROM public.audit_logs
       WHERE user_id = v_me AND created_at > (now() AT TIME ZONE 'utc') - interval '1 minute') >= 60 THEN
    RETURN 0;
  END IF;
  BEGIN
    v_ip := split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1);
  EXCEPTION WHEN others THEN
    v_ip := NULL;
  END;

  INSERT INTO public.audit_logs (id, company_id, user_id, action, entity_type, metadata,
                                 created_at, event_type, outcome, ip_address, user_agent)
  SELECT gen_random_uuid(), cm.company_id, v_me, p_event_type, COALESCE(left(p_entity_type, 50), 'auth'), v_meta,
         (now() AT TIME ZONE 'utc'), p_event_type, p_outcome, NULLIF(trim(v_ip), ''), left(p_user_agent, 500)
  FROM public.company_memberships cm
  WHERE cm.user_id = v_me
    AND cm.status = 'active'
    AND (p_company_id IS NULL OR cm.company_id = p_company_id);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END
$$;
REVOKE ALL ON FUNCTION public.log_audit_event(text, text, uuid, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, uuid, jsonb, text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Storage
-- -----------------------------------------------------------------------------

-- 5a/5b. Private buckets: public URLs stop working; the app now uses signed URLs.
UPDATE storage.buckets SET public = false WHERE id IN ('certifications', 'operation-maps');

-- certifications: path is {auth uid}/{uuid}.{ext}. Readable by the owner of
-- the file and by owner/admin/manager of a company the file owner belongs to.
CREATE OR REPLACE FUNCTION public.can_view_member_files(p_supabase_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users target
    JOIN public.company_memberships tm ON tm.user_id = target.id
    JOIN public.company_memberships sup ON sup.company_id = tm.company_id
    JOIN public.users me ON me.id = sup.user_id
    WHERE target.supabase_id = p_supabase_id
      AND me.supabase_id = auth.uid()::text
      AND sup.status = 'active'
      AND sup.role IN ('owner', 'admin', 'manager')
  )
$$;
REVOKE ALL ON FUNCTION public.can_view_member_files(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_member_files(text) TO authenticated;

DROP POLICY IF EXISTS "certifications: owner or company supervisors can read" ON storage.objects;
CREATE POLICY "certifications: owner or company supervisors can read" ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    bucket_id = 'certifications'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.can_view_member_files((storage.foldername(name))[1])
    )
  );

-- operation-maps: the live read/upload/update/delete policies are already
-- company-scoped (first path segment = company id); making the bucket private
-- is what actually enforces them for reads.

-- 5c. applicant-documents
DROP POLICY IF EXISTS "Anyone can upload applicant documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view applicant documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete applicant documents" ON storage.objects;

CREATE OR REPLACE FUNCTION public.company_exists(p_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_company_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id)
$$;
REVOKE ALL ON FUNCTION public.company_exists(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.company_exists(uuid) TO anon, authenticated;

-- Write-only drop box for the public /apply form: anonymous applicants can
-- add files under {companyId}/{applicantId}/{file} for a real company, but
-- cannot list, read, overwrite (no UPDATE policy; the app uses upsert:false)
-- or delete anything. Trade-off: anyone can still upload junk (size and MIME
-- limited by the bucket); a signed-upload edge function would close that.
CREATE POLICY "applicant-documents: drop-box upload" ON storage.objects
  AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'applicant-documents'
    AND array_length(storage.foldername(name), 1) = 2
    AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.company_exists(public.storage_path_company(name))
  );

CREATE POLICY "applicant-documents: company managers can read" ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    bucket_id = 'applicant-documents'
    AND public.is_company_admin(public.storage_path_company(name))
  );

CREATE POLICY "applicant-documents: company managers can delete" ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    bucket_id = 'applicant-documents'
    AND public.is_company_admin(public.storage_path_company(name))
  );

COMMIT;
