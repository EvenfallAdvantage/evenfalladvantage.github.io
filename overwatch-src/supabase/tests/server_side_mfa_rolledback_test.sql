-- Rolled-back dry run of 20261022000000 (migration body + assertions). Never commits.
BEGIN;
-- Server-side 2FA enforcement (DRAFT: not applied).
-- When companies.settings->>'require_mfa_admins' is true, owners/admins of that
-- company must present an aal2 session (TOTP verified) to:
--   * read or write api_keys, integrations_config, integration_connections, audit_logs, invoices
--   * insert/update/delete companies, company_memberships, timesheets
--   * call the admin RPCs patched below
-- Everyone else (staff, other companies, service_role) is unaffected.
-- Rollback: migrations/rollback/20261022000000_server_side_mfa_enforcement.rollback.sql

CREATE OR REPLACE FUNCTION public.mfa_enforced_for_me(p_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.companies c
    JOIN public.company_memberships cm ON cm.company_id = c.id
    JOIN public.users u ON u.id = cm.user_id
    WHERE c.id = p_company_id
      AND c.settings->>'require_mfa_admins' = 'true'
      AND u.supabase_id = (SELECT auth.uid())::text
      AND cm.role IN ('owner'::public."CompanyRole", 'admin'::public."CompanyRole")
  );
$$;

CREATE OR REPLACE FUNCTION public.mfa_ok(p_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT COALESCE((SELECT auth.jwt()->>'aal'), '') = 'aal2'
      OR NOT public.mfa_enforced_for_me(p_company_id);
$$;

CREATE OR REPLACE FUNCTION public.assert_mfa_for_company(p_company_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.mfa_ok(p_company_id) THEN
    RAISE EXCEPTION 'Two-factor verification required for this action'
      USING ERRCODE = '42501', HINT = 'mfa_required';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mfa_enforced_for_me(uuid), public.mfa_ok(uuid), public.assert_mfa_for_company(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mfa_enforced_for_me(uuid), public.mfa_ok(uuid), public.assert_mfa_for_company(uuid) TO authenticated, service_role;

-- Restrictive policies (AND-ed with the existing permissive ones).
CREATE POLICY mfa_required_all ON public.api_keys AS RESTRICTIVE FOR ALL TO authenticated USING (public.mfa_ok(company_id)) WITH CHECK (public.mfa_ok(company_id));
CREATE POLICY mfa_required_all ON public.integrations_config AS RESTRICTIVE FOR ALL TO authenticated USING (public.mfa_ok(company_id)) WITH CHECK (public.mfa_ok(company_id));
CREATE POLICY mfa_required_all ON public.integration_connections AS RESTRICTIVE FOR ALL TO authenticated USING (public.mfa_ok(company_id)) WITH CHECK (public.mfa_ok(company_id));
CREATE POLICY mfa_required_all ON public.audit_logs AS RESTRICTIVE FOR ALL TO authenticated USING (public.mfa_ok(company_id)) WITH CHECK (public.mfa_ok(company_id));
CREATE POLICY mfa_required_all ON public.invoices AS RESTRICTIVE FOR ALL TO authenticated USING (public.mfa_ok(company_id)) WITH CHECK (public.mfa_ok(company_id));

-- Writes only (reads stay open so the app can load the role and show the 2FA prompt).
CREATE POLICY mfa_required_insert ON public.companies AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.mfa_ok(id));
CREATE POLICY mfa_required_update ON public.companies AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.mfa_ok(id)) WITH CHECK (public.mfa_ok(id));
CREATE POLICY mfa_required_delete ON public.companies AS RESTRICTIVE FOR DELETE TO authenticated USING (public.mfa_ok(id));
CREATE POLICY mfa_required_insert ON public.company_memberships AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.mfa_ok(company_id));
CREATE POLICY mfa_required_update ON public.company_memberships AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.mfa_ok(company_id)) WITH CHECK (public.mfa_ok(company_id));
CREATE POLICY mfa_required_delete ON public.company_memberships AS RESTRICTIVE FOR DELETE TO authenticated USING (public.mfa_ok(company_id));
CREATE POLICY mfa_required_insert ON public.timesheets AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.mfa_ok(company_id));
CREATE POLICY mfa_required_update ON public.timesheets AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.mfa_ok(company_id)) WITH CHECK (public.mfa_ok(company_id));
CREATE POLICY mfa_required_delete ON public.timesheets AS RESTRICTIVE FOR DELETE TO authenticated USING (public.mfa_ok(company_id));

-- Admin RPCs (SECURITY DEFINER bypasses RLS, so they check explicitly).
-- Bodies below are the live definitions with one PERFORM line added.
CREATE OR REPLACE FUNCTION public.set_member_pay_rate(p_membership_id uuid, p_pay_rate numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_target public.company_memberships%ROWTYPE;
  v_caller_role text;
BEGIN
  PERFORM public.assert_mfa_for_company((SELECT cm.company_id FROM public.company_memberships cm WHERE cm.id = p_membership_id)); -- server-side 2FA (20261022000000)
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
$function$;

CREATE OR REPLACE FUNCTION public.update_member_admin_profile(p_membership_id uuid, p_user_fields jsonb DEFAULT '{}'::jsonb, p_membership_fields jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_target RECORD;
  v_caller RECORD;
  v_user_fields JSONB := '{}'::jsonb;
  v_membership_fields JSONB := '{}'::jsonb;
  v_key TEXT;
  v_jval JSONB;
  v_claim TEXT;
  v_user_updated BOOLEAN := false;
  v_membership_updated BOOLEAN := false;
BEGIN
  PERFORM public.assert_mfa_for_company((SELECT cm.company_id FROM public.company_memberships cm WHERE cm.id = p_membership_id)); -- server-side 2FA (20261022000000)
  -- Load target membership + its users row
  SELECT cm.*, u.supabase_id AS user_supabase_id
    INTO v_target
    FROM company_memberships cm
    JOIN users u ON u.id = cm.user_id
   WHERE cm.id = p_membership_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membership not found';
  END IF;

  -- Load caller's membership in the same company
  SELECT cm.* INTO v_caller
    FROM company_memberships cm
    JOIN users u ON u.id = cm.user_id
   WHERE u.supabase_id = auth.uid()::text
     AND cm.company_id = v_target.company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You are not a member of this company';
  END IF;

  -- Authorization: owner edits anyone; otherwise caller rank must be
  -- strictly greater than the target's rank.
  IF v_caller.role <> 'owner' THEN
    IF v_caller.role = 'admin' THEN
      IF v_target.role IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Admins cannot edit owners or other admins';
      END IF;
    ELSIF v_caller.role = 'manager' THEN
      IF v_target.role IN ('owner', 'admin', 'manager') THEN
        RAISE EXCEPTION 'Managers can only edit staff profiles';
      END IF;
    ELSE
      RAISE EXCEPTION 'Only owners, admins, and managers can edit profiles';
    END IF;
  END IF;

  -- Prevent a member from editing their own profile through this RPC
  -- (they should use the personal-profile card instead).
  IF v_target.user_id = v_caller.user_id THEN
    RAISE EXCEPTION 'Edit your own profile from your personal profile page';
  END IF;

  -- Whitelist user fields (email is the auth identity and must not be
  -- editable through this path). JSON null clears the column.
  IF jsonb_typeof(p_user_fields) = 'object' THEN
    FOR v_key, v_jval IN SELECT * FROM jsonb_each(p_user_fields) LOOP
      IF v_key IN ('first_name', 'last_name', 'callsign', 'phone') THEN
        IF jsonb_typeof(v_jval) = 'null' THEN
          v_user_fields := jsonb_set(v_user_fields, ARRAY[v_key], 'null'::jsonb);
        ELSIF jsonb_typeof(v_jval) = 'string' THEN
          v_claim := NULLIF(trim(v_jval #>> '{}'), '');
          v_user_fields := jsonb_set(
            v_user_fields,
            ARRAY[v_key],
            CASE WHEN v_claim IS NULL THEN 'null'::jsonb ELSE to_jsonb(v_claim) END
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Whitelist membership profile fields (scalars + text-array columns).
  IF jsonb_typeof(p_membership_fields) = 'object' THEN
    FOR v_key, v_jval IN SELECT * FROM jsonb_each(p_membership_fields) LOOP
      IF v_key IN ('work_preferences', 'dietary_restrictions') THEN
        IF jsonb_typeof(v_jval) = 'array' THEN
          v_membership_fields := jsonb_set(v_membership_fields, ARRAY[v_key], v_jval);
        END IF;
      ELSIF v_key IN (
        'bio', 'title', 'address', 'hire_date',
        'emergency_contact_name', 'emergency_contact_phone',
        'guard_card_number', 'guard_card_expiry',
        'shirt_size', 'jacket_size'
      ) THEN
        IF jsonb_typeof(v_jval) = 'null' THEN
          v_membership_fields := jsonb_set(v_membership_fields, ARRAY[v_key], 'null'::jsonb);
        ELSIF jsonb_typeof(v_jval) = 'string' THEN
          v_claim := NULLIF(trim(v_jval #>> '{}'), '');
          v_membership_fields := jsonb_set(
            v_membership_fields,
            ARRAY[v_key],
            CASE WHEN v_claim IS NULL THEN 'null'::jsonb ELSE to_jsonb(v_claim) END
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  IF v_user_fields <> '{}'::jsonb THEN
    EXECUTE
      'UPDATE public.users SET updated_at = now()'
      || (
        SELECT string_agg(format(', %I = $2->>%L', k.key, k.key), '')
          FROM jsonb_object_keys(v_user_fields) AS k(key)
      )
      || ' WHERE id = $1'
    USING v_target.user_id, v_user_fields;
    v_user_updated := true;
  END IF;

  IF v_membership_fields <> '{}'::jsonb THEN
    EXECUTE
      'UPDATE public.company_memberships SET updated_at = now()'
      || (
        SELECT string_agg(
          CASE WHEN k.key IN ('work_preferences', 'dietary_restrictions')
               THEN format(', %I = ARRAY(SELECT jsonb_array_elements_text($2->%L))', k.key, k.key)
               ELSE format(', %I = $2->>%L', k.key, k.key)
          END, '')
          FROM jsonb_object_keys(v_membership_fields) AS k(key)
      )
      || ' WHERE id = $1'
    USING p_membership_id, v_membership_fields;
    v_membership_updated := true;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'membership_id', p_membership_id,
    'user_id', v_target.user_id,
    'user_updated', v_user_updated,
    'membership_updated', v_membership_updated
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_member_role(p_membership_id uuid, p_new_role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_target RECORD;
  v_caller RECORD;
  v_caller_rank int;
BEGIN
  PERFORM public.assert_mfa_for_company((SELECT cm.company_id FROM public.company_memberships cm WHERE cm.id = p_membership_id)); -- server-side 2FA (20261022000000)
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
$function$;

CREATE OR REPLACE FUNCTION public.remove_company_member(p_membership_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_target RECORD;
  v_caller RECORD;
BEGIN
  PERFORM public.assert_mfa_for_company((SELECT cm.company_id FROM public.company_memberships cm WHERE cm.id = p_membership_id)); -- server-side 2FA (20261022000000)
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
$function$;

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
  PERFORM public.assert_mfa_for_company(p_company_id); -- server-side 2FA (20261022000000)
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

CREATE OR REPLACE FUNCTION public.add_client_member(p_company_id uuid, p_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_caller_role text;
  v_user_id uuid;
  v_existing text;
BEGIN
  PERFORM public.assert_mfa_for_company(p_company_id); -- server-side 2FA (20261022000000)
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
$function$;

CREATE OR REPLACE FUNCTION public.convert_applicant_to_roster(p_applicant_id uuid, p_company_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_applicant record;
  v_existing_user_id uuid;
  v_new_user_id uuid;
  v_user_id uuid;
  v_is_manager boolean;
BEGIN
  PERFORM public.assert_mfa_for_company(p_company_id); -- server-side 2FA (20261022000000)
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE u.supabase_id = auth.uid()::text
      AND cm.company_id = p_company_id
      AND cm.role IN ('manager', 'admin', 'owner')
  ) INTO v_is_manager;
  
  IF NOT v_is_manager THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_applicant FROM public.applicants WHERE id = p_applicant_id;
  IF v_applicant IS NULL THEN
    RAISE EXCEPTION 'Applicant not found';
  END IF;

  SELECT id INTO v_existing_user_id FROM public.users WHERE email = v_applicant.email LIMIT 1;

  IF v_existing_user_id IS NOT NULL THEN
    v_user_id := v_existing_user_id;
  ELSE
    v_new_user_id := gen_random_uuid();
    INSERT INTO public.users (id, email, first_name, last_name, phone, created_at, updated_at)
    VALUES (v_new_user_id, v_applicant.email, v_applicant.first_name, v_applicant.last_name, v_applicant.phone, now(), now());
    v_user_id := v_new_user_id;
  END IF;

  INSERT INTO public.company_memberships (
    id, user_id, company_id, role, status,
    guard_card_number, guard_card_expiry, address,
    work_preferences, hire_date, onboarding_complete,
    created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_user_id, p_company_id, 'staff', 'active',
    v_applicant.guard_card_number, v_applicant.guard_card_expiry, v_applicant.address,
    '{}'::text[], now(), true,
    now(), now()
  )
  ON CONFLICT (user_id, company_id) DO UPDATE SET
    status = 'active',
    onboarding_complete = true,
    updated_at = now();
  -- NOTE: intentionally does NOT overwrite role — preserves existing owner/admin/manager

  UPDATE public.applicants
  SET converted_user_id = v_user_id, status = 'hired',
      hired_at = COALESCE(hired_at, now()), updated_at = now()
  WHERE id = p_applicant_id;

  RETURN jsonb_build_object('user_id', v_user_id, 'existing', v_existing_user_id IS NOT NULL);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_company_join_code(p_company_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM public.assert_mfa_for_company(p_company_id); -- server-side 2FA (20261022000000)
  IF COALESCE(public.my_company_role(p_company_id), '') NOT IN ('owner', 'admin', 'manager') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT code FROM public.company_join_codes WHERE company_id = p_company_id);
END
$function$;

-- Assertions (run inside the rolled-back transaction). ZZTEST Field QA only.
SELECT set_config('t.cid', 'afe19261-d1a8-4c4e-91e4-0351bed0c3b3', true);
SELECT set_config('t.sub', (SELECT supabase_id FROM public.users WHERE id = '81327070-dd63-445b-8810-67363ca4a541'), true);
-- turn the policy on for ZZTEST only
UPDATE public.companies SET settings = COALESCE(settings, '{}'::jsonb) || '{"require_mfa_admins": true}' WHERE id = current_setting('t.cid')::uuid;

CREATE TEMP TABLE r(k text, v text) ON COMMIT DROP;
GRANT ALL ON r TO authenticated;

-- aal1 owner
SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('t.sub'), 'role','authenticated','aal','aal1')::text, true);
SET LOCAL ROLE authenticated;
INSERT INTO r SELECT 'aal1_audit_rows', count(*)::text FROM public.audit_logs;
INSERT INTO r SELECT 'aal1_company_read', count(*)::text FROM public.companies;
WITH u AS (UPDATE public.companies SET name = name WHERE id = current_setting('t.cid')::uuid RETURNING 1) INSERT INTO r SELECT 'aal1_company_update', count(*)::text FROM u;
DO $$ BEGIN PERFORM public.get_company_join_code(current_setting('t.cid')::uuid); INSERT INTO r VALUES ('aal1_rpc','allowed');
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r VALUES ('aal1_rpc','blocked:'||SQLERRM); END $$;
RESET ROLE;

-- aal2 owner
SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('t.sub'), 'role','authenticated','aal','aal2')::text, true);
SET LOCAL ROLE authenticated;
INSERT INTO r SELECT 'aal2_audit_rows', count(*)::text FROM public.audit_logs;
WITH u AS (UPDATE public.companies SET name = name WHERE id = current_setting('t.cid')::uuid RETURNING 1) INSERT INTO r SELECT 'aal2_company_update', count(*)::text FROM u;
DO $$ BEGIN PERFORM public.get_company_join_code(current_setting('t.cid')::uuid); INSERT INTO r VALUES ('aal2_rpc','allowed');
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r VALUES ('aal2_rpc','blocked:'||SQLERRM); END $$;
RESET ROLE;

-- policy off again -> aal1 allowed
UPDATE public.companies SET settings = settings - 'require_mfa_admins' WHERE id = current_setting('t.cid')::uuid;
SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('t.sub'), 'role','authenticated','aal','aal1')::text, true);
SET LOCAL ROLE authenticated;
INSERT INTO r SELECT 'off_aal1_audit_rows', count(*)::text FROM public.audit_logs;
RESET ROLE;

SELECT string_agg(k||'='||v, '; ' ORDER BY k) AS results FROM r;

ROLLBACK;
