-- =============================================================================
-- 20261106234500_airtable_roster_phone_conflict.sql
-- Target: OverwatchDB (project nneueuvyeohwnspbwfub) ONLY.
-- Status: NOT APPLIED. Do not run this from an agent, CI, or a deploy.
--         Apply by hand after review. It does not UPDATE or DELETE any user
--         or auth row, and it does not drop users_phone_key.
-- Rollback: rollback/20261106234500_airtable_roster_phone_conflict.rollback.sql
--
-- Replaces apply_airtable_roster_sync from 20261106223000. A duplicate phone
-- fails that row only. The rest of the plan still commits, and removals stay
-- held when any earlier row failed. The returned message does not include the
-- phone or the other account.
--
-- Phone comparison is digits only: every non-digit is removed. It does not
-- fold a country code, so +1 5551234567 and 5551234567 stay different. It
-- does not strip extensions, so 5551234567 and 5551234567x12 stay different.
-- users_phone_key remains an exact btree on the stored text.
--
-- Locks: every distinct digit key in the plan is try-locked in sorted order
-- before any membership row lock. try_lock does not wait. A key held by
-- another sync fails that row closed. Blocking locks in plan order can
-- deadlock opposite batches and wait until the other call commits.
-- =============================================================================

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.users') IS NULL
     OR to_regclass('public.company_memberships') IS NULL
     OR to_regprocedure('public.assert_mfa_for_company(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Wrong database: this migration is for OverwatchDB (nneueuvyeohwnspbwfub)';
  END IF;
END
$guard$;

-- Read-only phone check. Returns the trimmed phone to store, or NULL when the
-- value is blank or already this account's number (same digits, formatting
-- ignored). Raises when any other account has the same digits, or when the
-- digit lock is already held by another sync. Does not write, link, or return
-- that account. Digits are not a canonical phone number: country codes and
-- extensions are not removed. The existence check repeats regexp_replace on
-- users.phone and can scan that table once per phone; there is no expression
-- index. A warm lookup of 4000 users measured about 1 ms. The caller try-locks
-- distinct digits in sorted order first.
CREATE OR REPLACE FUNCTION public.airtable_roster_phone_to_store(
  p_user_id uuid,
  p_phone text
) RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_raw text;
  v_digits text;
  v_own text;
BEGIN
  v_raw := NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_phone, '')), 200), '');
  IF v_raw IS NULL THEN
    RETURN NULL;
  END IF;
  v_digits := pg_catalog.regexp_replace(v_raw, '[^0-9]', '', 'g');
  IF v_digits = '' THEN
    RETURN NULL;
  END IF;
  -- Fail closed. A blocking lock would wait until the other sync commits,
  -- and locks taken in plan order deadlock when two batches use opposite
  -- phone order. try_lock returns immediately. The caller also takes these
  -- locks in sorted digit order before any membership row lock.
  IF NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('airtable-roster-phone:' || v_digits, 0)) THEN
    RAISE EXCEPTION 'Another roster sync is updating this phone. This row was not saved. Run the sync again.'
      USING ERRCODE = 'P0001';
  END IF;
  SELECT pg_catalog.regexp_replace(coalesce(u.phone, ''), '[^0-9]', '', 'g')
    INTO v_own
  FROM public.users u
  WHERE u.id = p_user_id;
  IF v_own IS NOT NULL AND v_own <> '' AND v_own = v_digits THEN
    RETURN NULL;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id IS DISTINCT FROM p_user_id
      AND u.phone IS NOT NULL
      AND pg_catalog.regexp_replace(u.phone, '[^0-9]', '', 'g') = v_digits
  ) THEN
    RAISE EXCEPTION 'Phone is already on another Overwatch account. That account was not changed, and this row was not saved. Accounts are not matched or merged by phone.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN v_raw;
END
$fn$;

COMMENT ON FUNCTION public.airtable_roster_phone_to_store(uuid, text) IS
  'Normalizes one roster phone for the account being written. NULL means store nothing new. Never matches or updates a different account.';

CREATE OR REPLACE FUNCTION public.airtable_roster_failure_text(
  p_constraint text,
  p_message text
) RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
  SELECT pg_catalog.left(
    CASE
      WHEN p_constraint IN ('users_phone_key', 'users_phone_unique')
        OR pg_catalog.strpos(coalesce(p_message, ''), 'users_phone_key') > 0
        OR pg_catalog.strpos(coalesce(p_message, ''), 'users_phone_unique') > 0
        OR coalesce(p_message, '') LIKE 'Phone is already on another Overwatch account%'
        OR coalesce(p_message, '') LIKE 'Another roster sync is updating this phone%'
      THEN CASE
        WHEN coalesce(p_message, '') LIKE 'Another roster sync is updating this phone%'
        THEN 'Another roster sync is updating this phone. This row was not saved. Run the sync again.'
        ELSE 'Phone is already on another Overwatch account. That account was not changed, and this row was not saved. Accounts are not matched or merged by phone.'
      END
      ELSE pg_catalog.regexp_replace(coalesce(p_message, 'This row was not saved'), '\+?[0-9][0-9 ().+-]{6,}[0-9]', '[phone]', 'g')
    END,
    180
  );
$fn$;

COMMENT ON FUNCTION public.airtable_roster_failure_text(text, text) IS
  'Row-failure text for roster sync. Phone conflicts keep a fixed message with no number and no other account.';

REVOKE ALL ON FUNCTION public.airtable_roster_phone_to_store(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.airtable_roster_failure_text(text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.apply_airtable_roster_sync(
  p_company_id uuid,
  p_base_id text,
  p_table_id text,
  p_plan jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_role text;
  v_settings jsonb;
  v_map jsonb;
  v_created int := 0;
  v_attached int := 0;
  v_linked int := 0;
  v_updated int := 0;
  v_removed int := 0;
  v_item jsonb;
  v_email text;
  v_user_id uuid;
  v_membership_id uuid;
  v_member_user uuid;
  v_member_role text;
  v_ids uuid[];
  v_ext text;
  v_airtable text;
  v_title text;
  v_count int;
  v_new_user boolean;
  v_new_membership boolean;
  v_phone text;
  v_digits text;
  v_constraint text;
  v_fail_create int := 0;
  v_fail_attach int := 0;
  v_fail_link int := 0;
  v_fail_update int := 0;
  v_fail_remove int := 0;
  v_failures jsonb := '[]'::jsonb;
BEGIN
  PERFORM public.assert_mfa_for_company(p_company_id);
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_base_id !~ '^app[A-Za-z0-9]{14}$' OR p_table_id !~ '^tbl[A-Za-z0-9]{14}$' THEN
    RAISE EXCEPTION 'invalid airtable table' USING ERRCODE = '22023';
  END IF;
  IF p_plan IS NULL OR jsonb_typeof(p_plan) <> 'object' THEN
    RAISE EXCEPTION 'Roster plan is missing' USING ERRCODE = '22023';
  END IF;
  IF (p_plan ? 'creates' AND jsonb_typeof(p_plan->'creates') <> 'array')
     OR (p_plan ? 'attaches' AND jsonb_typeof(p_plan->'attaches') <> 'array')
     OR (p_plan ? 'links' AND jsonb_typeof(p_plan->'links') <> 'array')
     OR (p_plan ? 'updates' AND jsonb_typeof(p_plan->'updates') <> 'array')
     OR (p_plan ? 'removals' AND jsonb_typeof(p_plan->'removals') <> 'array') THEN
    RAISE EXCEPTION 'Roster plan is missing' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_plan) AS key
    WHERE key NOT IN ('creates', 'attaches', 'links', 'updates', 'removals')
  ) THEN
    RAISE EXCEPTION 'Roster plan has an unsupported change' USING ERRCODE = '22023';
  END IF;

  SELECT cm.role::text INTO v_role
  FROM public.company_memberships cm
  JOIN public.users u ON u.id = cm.user_id
  WHERE u.supabase_id = auth.uid()::text
    AND cm.company_id = p_company_id
    AND cm.status = 'active'
  FOR UPDATE OF cm;
  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin', 'manager') THEN
    RAISE EXCEPTION 'Forbidden — owner/admin/manager required' USING ERRCODE = '42501';
  END IF;

  SELECT c.settings INTO v_settings
  FROM public.integration_connections c
  WHERE c.company_id = p_company_id AND c.provider = 'airtable' AND c.status = 'connected';
  IF v_settings IS NULL
     OR v_settings->>'roster_base_id' IS DISTINCT FROM p_base_id
     OR v_settings->>'roster_table_id' IS DISTINCT FROM p_table_id THEN
    RAISE EXCEPTION 'Save the roster table before syncing' USING ERRCODE = '42501';
  END IF;

  SELECT m.mappings INTO v_map
  FROM public.airtable_field_mappings m
  WHERE m.company_id = p_company_id AND m.purpose = 'roster'
    AND m.base_id = p_base_id AND m.table_id = p_table_id
    AND m.confirmed_at IS NOT NULL;
  IF v_map IS NULL THEN
    RAISE EXCEPTION 'Confirm the field mapping before the first sync' USING ERRCODE = '42501';
  END IF;
  IF v_map ? 'role' OR v_map ? 'status' OR v_map ? 'pay' OR v_map ? 'pay_rate' THEN
    RAISE EXCEPTION 'Airtable cannot map role or status' USING ERRCODE = '22023';
  END IF;

  IF coalesce(jsonb_array_length(p_plan->'creates'), 0) > 1000
     OR coalesce(jsonb_array_length(p_plan->'attaches'), 0) > 1000
     OR coalesce(jsonb_array_length(p_plan->'links'), 0) > 1000
     OR coalesce(jsonb_array_length(p_plan->'updates'), 0) > 1000
     OR coalesce(jsonb_array_length(p_plan->'removals'), 0) > 2000 THEN
    RAISE EXCEPTION 'Roster plan is too large' USING ERRCODE = '22023';
  END IF;

  -- Sorted try-locks before any membership FOR UPDATE. False is remembered
  -- by a second try in airtable_roster_phone_to_store, which fails that row.
  FOR v_digits IN
    SELECT DISTINCT pg_catalog.regexp_replace(
      pg_catalog.left(pg_catalog.btrim(coalesce(phones.phone, '')), 200),
      '[^0-9]', '', 'g'
    ) AS digits
    FROM (
      SELECT value->>'phone' AS phone
      FROM jsonb_array_elements(coalesce(p_plan->'creates', '[]'::jsonb))
      UNION ALL
      SELECT value->>'phone'
      FROM jsonb_array_elements(coalesce(p_plan->'links', '[]'::jsonb))
      UNION ALL
      SELECT value->>'phone'
      FROM jsonb_array_elements(coalesce(p_plan->'updates', '[]'::jsonb))
    ) AS phones(phone)
    WHERE pg_catalog.regexp_replace(
      pg_catalog.left(pg_catalog.btrim(coalesce(phones.phone, '')), 200),
      '[^0-9]', '', 'g'
    ) <> ''
    ORDER BY 1
  LOOP
    PERFORM pg_catalog.pg_try_advisory_xact_lock(
      pg_catalog.hashtextextended('airtable-roster-phone:' || v_digits, 0)
    );
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(coalesce(p_plan->'creates', '[]'::jsonb))
  LOOP
    BEGIN
    IF jsonb_typeof(v_item) <> 'object' OR v_item ? 'role' OR v_item ? 'status' OR v_item ? 'pay' OR v_item ? 'pay_rate' THEN
      RAISE EXCEPTION 'Airtable cannot change role or status' USING ERRCODE = '22023';
    END IF;
    v_airtable := v_item->>'airtable_id';
    v_email := lower(btrim(coalesce(v_item->>'email', '')));
    IF v_airtable !~ '^rec[A-Za-z0-9]{14}$' OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
      RAISE EXCEPTION 'Roster create is missing an Airtable id or email' USING ERRCODE = '22023';
    END IF;
    IF length(btrim(coalesce(v_item->>'first_name', ''))) = 0 THEN
      RAISE EXCEPTION 'first_name is required' USING ERRCODE = '22023';
    END IF;
    v_new_user := false;
    SELECT coalesce(array_agg(u.id ORDER BY u.id), ARRAY[]::uuid[]) INTO v_ids
    FROM public.users u
    WHERE lower(u.email) = v_email;
    IF coalesce(array_length(v_ids, 1), 0) > 1 THEN
      RAISE EXCEPTION 'This email matches more than one Overwatch account' USING ERRCODE = '23505';
    ELSIF coalesce(array_length(v_ids, 1), 0) = 1 THEN
      v_user_id := v_ids[1];
    ELSE
      v_user_id := gen_random_uuid();
      -- Blank and same-digit own numbers return NULL. A number held by any
      -- other account raises before the insert and does not reuse that account.
      v_phone := public.airtable_roster_phone_to_store(v_user_id, v_item->>'phone');
      BEGIN
        INSERT INTO public.users (id, email, first_name, last_name, phone, supabase_id, created_at, updated_at)
        VALUES (
          v_user_id, v_email,
          left(btrim(v_item->>'first_name'), 200),
          left(btrim(coalesce(v_item->>'last_name', '')), 200),
          v_phone,
          NULL, now(), now()
        );
        v_new_user := true;
      EXCEPTION WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint IN ('users_phone_key', 'users_phone_unique')
           OR position('users_phone_key' in SQLERRM) > 0
           OR position('users_phone_unique' in SQLERRM) > 0 THEN
          RAISE EXCEPTION 'Phone is already on another Overwatch account. That account was not changed, and this row was not saved. Accounts are not matched or merged by phone.'
            USING ERRCODE = 'P0001';
        END IF;
        SELECT coalesce(array_agg(u.id ORDER BY u.id), ARRAY[]::uuid[]) INTO v_ids
        FROM public.users u
        WHERE lower(u.email) = v_email;
        IF coalesce(array_length(v_ids, 1), 0) <> 1 THEN
          RAISE EXCEPTION 'Could not reuse the existing account for this email' USING ERRCODE = '23505';
        END IF;
        -- Email race only. Do not copy this row's phone onto the reused account.
        v_user_id := v_ids[1];
        v_new_user := false;
      END;
    END IF;

    v_new_membership := false;
    SELECT cm.id, cm.role::text INTO v_membership_id, v_member_role
    FROM public.company_memberships cm
    WHERE cm.company_id = p_company_id AND cm.user_id = v_user_id
    FOR UPDATE;
    IF FOUND THEN
      IF v_member_role IN ('owner', 'admin', 'manager') THEN
        RAISE EXCEPTION 'Airtable cannot change an owner, admin, or manager' USING ERRCODE = '42501';
      END IF;
    ELSE
      INSERT INTO public.company_memberships (
        id, user_id, company_id, role, status, title,
        work_preferences, notification_days, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), v_user_id, p_company_id,
        'staff'::public."CompanyRole", 'active',
        NULLIF(left(btrim(coalesce(v_item->>'title', '')), 200), ''),
        ARRAY[]::text[],
        ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun']::text[],
        now(), now()
      )
      RETURNING id, role::text INTO v_membership_id, v_member_role;
      v_new_membership := true;
    END IF;
    IF v_member_role IN ('owner', 'admin', 'manager') THEN
      RAISE EXCEPTION 'Airtable cannot change an owner, admin, or manager' USING ERRCODE = '42501';
    END IF;
    v_title := NULLIF(left(btrim(coalesce(v_item->>'title', '')), 200), '');
    IF v_title IS NOT NULL AND NOT v_new_membership THEN
      UPDATE public.company_memberships
      SET title = v_title, updated_at = now()
      WHERE id = v_membership_id AND company_id = p_company_id AND user_id = v_user_id
        AND role::text NOT IN ('owner', 'admin', 'manager');
    END IF;
    BEGIN
      INSERT INTO public.employee_external_ids (company_id, user_id, provider, external_employee_id, match_method)
      VALUES (p_company_id, v_user_id, 'airtable', v_airtable, 'import');
    EXCEPTION WHEN unique_violation THEN
      SELECT e.external_employee_id INTO v_ext
      FROM public.employee_external_ids e
      WHERE e.company_id = p_company_id AND e.user_id = v_user_id AND e.provider = 'airtable';
      IF v_ext IS DISTINCT FROM v_airtable THEN
        RAISE EXCEPTION 'This person or Airtable record is already linked' USING ERRCODE = '23505';
      END IF;
    END;
    IF v_new_user AND v_new_membership THEN
      v_created := v_created + 1;
    ELSIF v_new_membership THEN
      v_attached := v_attached + 1;
    ELSE
      v_linked := v_linked + 1;
    END IF;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      v_fail_create := v_fail_create + 1;
      IF jsonb_array_length(v_failures) < 25 THEN
        v_failures := v_failures || jsonb_build_object('op', 'create', 'airtable_id', coalesce(v_airtable, ''), 'message', public.airtable_roster_failure_text(v_constraint, SQLERRM));
      END IF;
    END;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(coalesce(p_plan->'attaches', '[]'::jsonb))
  LOOP
    BEGIN
    IF jsonb_typeof(v_item) <> 'object' OR v_item ? 'role' OR v_item ? 'status' OR v_item ? 'pay' OR v_item ? 'pay_rate' THEN
      RAISE EXCEPTION 'Airtable cannot change role or status' USING ERRCODE = '22023';
    END IF;
    v_airtable := v_item->>'airtable_id';
    v_email := lower(btrim(coalesce(v_item->>'email', '')));
    IF v_airtable !~ '^rec[A-Za-z0-9]{14}$'
       OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
       OR coalesce(v_item->>'user_id', '') !~ '^[0-9a-fA-F-]{36}$' THEN
      RAISE EXCEPTION 'Roster attach is missing an account' USING ERRCODE = '22023';
    END IF;
    SELECT coalesce(array_agg(u.id ORDER BY u.id), ARRAY[]::uuid[]) INTO v_ids
    FROM public.users u
    WHERE lower(u.email) = v_email;
    IF coalesce(array_length(v_ids, 1), 0) <> 1 OR v_ids[1] IS DISTINCT FROM (v_item->>'user_id')::uuid THEN
      RAISE EXCEPTION 'This email belongs to a different account than the one confirmed' USING ERRCODE = '42501';
    END IF;
    v_user_id := v_ids[1];
    SELECT cm.id, cm.role::text INTO v_membership_id, v_member_role
    FROM public.company_memberships cm
    WHERE cm.company_id = p_company_id AND cm.user_id = v_user_id
    FOR UPDATE;
    IF FOUND THEN
      IF v_member_role IN ('owner', 'admin', 'manager') THEN
        RAISE EXCEPTION 'Airtable cannot change an owner, admin, or manager' USING ERRCODE = '42501';
      END IF;
      v_new_membership := false;
    ELSE
      INSERT INTO public.company_memberships (
        id, user_id, company_id, role, status, title,
        work_preferences, notification_days, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), v_user_id, p_company_id,
        'staff'::public."CompanyRole", 'active',
        NULLIF(left(btrim(coalesce(v_item->>'title', '')), 200), ''),
        ARRAY[]::text[],
        ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun']::text[],
        now(), now()
      )
      RETURNING id INTO v_membership_id;
      v_new_membership := true;
    END IF;
    BEGIN
      INSERT INTO public.employee_external_ids (company_id, user_id, provider, external_employee_id, match_method)
      VALUES (p_company_id, v_user_id, 'airtable', v_airtable, 'email');
    EXCEPTION WHEN unique_violation THEN
      SELECT e.external_employee_id INTO v_ext
      FROM public.employee_external_ids e
      WHERE e.company_id = p_company_id AND e.user_id = v_user_id AND e.provider = 'airtable';
      IF v_ext IS DISTINCT FROM v_airtable THEN
        RAISE EXCEPTION 'This person or Airtable record is already linked' USING ERRCODE = '23505';
      END IF;
    END;
    IF v_new_membership THEN v_attached := v_attached + 1; ELSE v_linked := v_linked + 1; END IF;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      v_fail_attach := v_fail_attach + 1;
      IF jsonb_array_length(v_failures) < 25 THEN
        v_failures := v_failures || jsonb_build_object('op', 'attach', 'airtable_id', coalesce(v_airtable, ''), 'message', public.airtable_roster_failure_text(v_constraint, SQLERRM));
      END IF;
    END;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(coalesce(p_plan->'links', '[]'::jsonb))
  LOOP
    BEGIN
    IF jsonb_typeof(v_item) <> 'object'
       OR v_item ? 'role' OR v_item ? 'status' OR v_item ? 'email' OR v_item ? 'pay' OR v_item ? 'pay_rate' THEN
      RAISE EXCEPTION 'Airtable cannot change role, status, or email' USING ERRCODE = '22023';
    END IF;
    v_airtable := v_item->>'airtable_id';
    IF v_airtable !~ '^rec[A-Za-z0-9]{14}$'
       OR coalesce(v_item->>'membership_id', '') !~ '^[0-9a-fA-F-]{36}$'
       OR coalesce(v_item->>'user_id', '') !~ '^[0-9a-fA-F-]{36}$' THEN
      RAISE EXCEPTION 'Roster link is missing its membership' USING ERRCODE = '22023';
    END IF;
    -- Lock the phone before the membership row so two syncs cannot both pass the digits check.
    v_phone := public.airtable_roster_phone_to_store((v_item->>'user_id')::uuid, v_item->>'phone');
    SELECT cm.id, cm.user_id, cm.role::text
      INTO v_membership_id, v_member_user, v_member_role
    FROM public.company_memberships cm
    WHERE cm.id = (v_item->>'membership_id')::uuid
      AND cm.company_id = p_company_id
    FOR UPDATE;
    IF NOT FOUND OR v_member_user IS DISTINCT FROM (v_item->>'user_id')::uuid THEN
      RAISE EXCEPTION 'Roster member was not found' USING ERRCODE = '42501';
    END IF;
    IF v_member_role IN ('owner', 'admin', 'manager') THEN
      RAISE EXCEPTION 'Airtable cannot change an owner, admin, or manager' USING ERRCODE = '42501';
    END IF;
    BEGIN
      INSERT INTO public.employee_external_ids (company_id, user_id, provider, external_employee_id, match_method)
      VALUES (p_company_id, v_member_user, 'airtable', v_airtable, 'email');
    EXCEPTION WHEN unique_violation THEN
      SELECT e.external_employee_id INTO v_ext
      FROM public.employee_external_ids e
      WHERE e.company_id = p_company_id AND e.user_id = v_member_user AND e.provider = 'airtable';
      IF v_ext IS DISTINCT FROM v_airtable THEN
        RAISE EXCEPTION 'This person or Airtable record is already linked' USING ERRCODE = '23505';
      END IF;
    END;
    UPDATE public.users
    SET first_name = coalesce(NULLIF(left(btrim(coalesce(v_item->>'first_name', '')), 200), ''), first_name),
        last_name = coalesce(NULLIF(left(btrim(coalesce(v_item->>'last_name', '')), 200), ''), last_name),
        phone = coalesce(v_phone, phone),
        updated_at = now()
    WHERE id = v_member_user;
    v_title := NULLIF(left(btrim(coalesce(v_item->>'title', '')), 200), '');
    IF v_title IS NOT NULL THEN
      UPDATE public.company_memberships
      SET title = v_title, updated_at = now()
      WHERE id = v_membership_id AND company_id = p_company_id AND user_id = v_member_user
        AND role::text NOT IN ('owner', 'admin', 'manager');
    END IF;
    v_linked := v_linked + 1;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      v_fail_link := v_fail_link + 1;
      IF jsonb_array_length(v_failures) < 25 THEN
        v_failures := v_failures || jsonb_build_object('op', 'link', 'airtable_id', coalesce(v_airtable, ''), 'message', public.airtable_roster_failure_text(v_constraint, SQLERRM));
      END IF;
    END;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(coalesce(p_plan->'updates', '[]'::jsonb))
  LOOP
    BEGIN
    IF jsonb_typeof(v_item) <> 'object'
       OR v_item ? 'role' OR v_item ? 'status' OR v_item ? 'email' OR v_item ? 'pay' OR v_item ? 'pay_rate' THEN
      RAISE EXCEPTION 'Airtable cannot change role, status, or email' USING ERRCODE = '22023';
    END IF;
    v_airtable := v_item->>'airtable_id';
    IF v_airtable !~ '^rec[A-Za-z0-9]{14}$'
       OR coalesce(v_item->>'membership_id', '') !~ '^[0-9a-fA-F-]{36}$'
       OR coalesce(v_item->>'user_id', '') !~ '^[0-9a-fA-F-]{36}$' THEN
      RAISE EXCEPTION 'Roster update is missing its membership' USING ERRCODE = '22023';
    END IF;
    -- Lock the phone before the membership row so two syncs cannot both pass the digits check.
    v_phone := public.airtable_roster_phone_to_store((v_item->>'user_id')::uuid, v_item->>'phone');
    SELECT cm.id, cm.user_id, cm.role::text
      INTO v_membership_id, v_member_user, v_member_role
    FROM public.company_memberships cm
    WHERE cm.id = (v_item->>'membership_id')::uuid
      AND cm.company_id = p_company_id
    FOR UPDATE;
    IF NOT FOUND OR v_member_user IS DISTINCT FROM (v_item->>'user_id')::uuid THEN
      RAISE EXCEPTION 'Roster member was not found' USING ERRCODE = '42501';
    END IF;
    SELECT e.external_employee_id INTO v_ext
    FROM public.employee_external_ids e
    WHERE e.company_id = p_company_id AND e.user_id = v_member_user AND e.provider = 'airtable';
    IF v_ext IS DISTINCT FROM v_airtable THEN
      RAISE EXCEPTION 'Airtable record is not linked to this person' USING ERRCODE = '42501';
    END IF;
    IF v_member_role IN ('owner', 'admin', 'manager') THEN
      -- Profile fields may follow Airtable. The link, email, role, and status stay.
      NULL;
    END IF;
    UPDATE public.users
    SET first_name = coalesce(NULLIF(left(btrim(coalesce(v_item->>'first_name', '')), 200), ''), first_name),
        last_name = coalesce(NULLIF(left(btrim(coalesce(v_item->>'last_name', '')), 200), ''), last_name),
        phone = coalesce(v_phone, phone),
        updated_at = now()
    WHERE id = v_member_user;
    v_title := NULLIF(left(btrim(coalesce(v_item->>'title', '')), 200), '');
    IF v_title IS NOT NULL THEN
      UPDATE public.company_memberships
      SET title = v_title, updated_at = now()
      WHERE id = v_membership_id AND company_id = p_company_id AND user_id = v_member_user;
    END IF;
    v_updated := v_updated + 1;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      v_fail_update := v_fail_update + 1;
      IF jsonb_array_length(v_failures) < 25 THEN
        v_failures := v_failures || jsonb_build_object('op', 'update', 'airtable_id', coalesce(v_airtable, ''), 'message', public.airtable_roster_failure_text(v_constraint, SQLERRM));
      END IF;
    END;
  END LOOP;

  IF v_fail_create = 0 AND v_fail_attach = 0 AND v_fail_link = 0 AND v_fail_update = 0 THEN
  FOR v_item IN SELECT value FROM jsonb_array_elements(coalesce(p_plan->'removals', '[]'::jsonb))
  LOOP
    BEGIN
    IF jsonb_typeof(v_item) <> 'object' OR v_item ? 'role' OR v_item ? 'status' THEN
      RAISE EXCEPTION 'Airtable cannot change role or status' USING ERRCODE = '22023';
    END IF;
    IF coalesce(v_item->>'membership_id', '') !~ '^[0-9a-fA-F-]{36}$'
       OR coalesce(v_item->>'user_id', '') !~ '^[0-9a-fA-F-]{36}$' THEN
      RAISE EXCEPTION 'Roster removal is missing its membership' USING ERRCODE = '22023';
    END IF;
    SELECT cm.id, cm.user_id, cm.role::text
      INTO v_membership_id, v_member_user, v_member_role
    FROM public.company_memberships cm
    WHERE cm.id = (v_item->>'membership_id')::uuid
      AND cm.company_id = p_company_id
    FOR UPDATE;
    IF NOT FOUND OR v_member_user IS DISTINCT FROM (v_item->>'user_id')::uuid THEN
      RAISE EXCEPTION 'Roster member was not found' USING ERRCODE = '42501';
    END IF;
    IF v_member_role IN ('owner', 'admin', 'manager') THEN
      RAISE EXCEPTION 'Airtable cannot remove an owner, admin, or manager' USING ERRCODE = '42501';
    END IF;
    DELETE FROM public.employee_external_ids e
    WHERE e.company_id = p_company_id AND e.user_id = v_member_user AND e.provider = 'airtable';
    DELETE FROM public.company_memberships cm
    WHERE cm.id = v_membership_id
      AND cm.company_id = p_company_id
      AND cm.user_id = v_member_user
      AND cm.role::text NOT IN ('owner', 'admin', 'manager');
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'Roster member was not removed' USING ERRCODE = '42501';
    END IF;
    v_removed := v_removed + 1;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      v_fail_remove := v_fail_remove + 1;
      IF jsonb_array_length(v_failures) < 25 THEN
        v_failures := v_failures || jsonb_build_object('op', 'remove', 'airtable_id', coalesce(v_item->>'membership_id', ''), 'message', public.airtable_roster_failure_text(v_constraint, SQLERRM));
      END IF;
    END;
  END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'created', v_created,
    'attached', v_attached,
    'linked', v_linked,
    'updated', v_updated,
    'removed', v_removed,
    'failed', jsonb_build_object(
      'create', v_fail_create,
      'attach', v_fail_attach,
      'link', v_fail_link,
      'update', v_fail_update,
      'remove', v_fail_remove
    ),
    'failures', v_failures
  );
END
$fn$;

COMMENT ON FUNCTION public.apply_airtable_roster_sync(uuid, text, text, jsonb) IS
  'Applies one confirmed Airtable roster plan. A failed row rolls back only that row; successful rows commit when the function returns. Removals are skipped after an earlier failure. A later removal failure does not undo earlier rows. Caller must be an active owner, admin, or manager. Deletes company memberships only; never public.users or auth.users. Does not change role, status, or a linked email. A phone that matches another account fails only that row and is not used to link or merge accounts. Blank phones are stored as NULL. The same digits as the target account are left unchanged.';

REVOKE ALL ON FUNCTION public.apply_airtable_roster_sync(uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_airtable_roster_sync(uuid, text, text, jsonb) TO authenticated;


NOTIFY pgrst, 'reload schema';

COMMIT;
