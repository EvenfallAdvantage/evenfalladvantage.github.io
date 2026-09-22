-- ============================================================
-- MIGRATION: Admin / manager editing of staff profiles
-- Provides update_member_admin_profile() — a SECURITY DEFINER RPC
-- that lets owners/admins/managers edit a member's profile fields
-- (users.first_name/last_name/callsign/phone + membership profile
-- fields). Email stays read-only (it is the auth identity), and role
-- changes stay in update_member_role(). Guard card / hire date are
-- whitelisted for completeness but not exposed in the UI.
--
-- Role rules (mirror fix-member-mgmt.sql):
--   owner            may edit any member of the company
--   admin            may edit managers and staff (not owners/admins)
--   manager          may edit staff only
--   staff            cannot use this RPC at all
--
-- Run in: Supabase Dashboard -> SQL Editor -> New Query
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_member_admin_profile(
  p_membership_id UUID,
  p_user_fields JSONB  DEFAULT '{}'::jsonb,
  p_membership_fields JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Lock down EXECUTE: authenticated only, never PUBLIC or anon.
REVOKE EXECUTE ON FUNCTION public.update_member_admin_profile(UUID, JSONB, JSONB) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.update_member_admin_profile(UUID, JSONB, JSONB) TO authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';