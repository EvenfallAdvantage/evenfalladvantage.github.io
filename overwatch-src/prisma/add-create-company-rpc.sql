-- ============================================================
-- RPC: create_company_with_owner — Atomic company creation
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================
-- This function handles the entire create-company flow atomically:
-- 1. Finds or creates the user record
-- 2. Creates the company (with slug collision handling)
-- 3. Creates owner membership
-- All inside SECURITY DEFINER so RLS doesn't block it.

CREATE OR REPLACE FUNCTION public.create_company_with_owner(
  p_company_name TEXT,
  p_supabase_id TEXT,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_first_name TEXT DEFAULT '',
  p_last_name TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company RECORD;
  v_user RECORD;
  v_membership RECORD;
  v_slug TEXT;
  v_base_slug TEXT;
  v_join_code TEXT;
  v_attempt INT := 0;
BEGIN
  -- 1. Find or create user
  SELECT * INTO v_user
    FROM users
    WHERE supabase_id = p_supabase_id;

  IF NOT FOUND THEN
    INSERT INTO users (id, supabase_id, email, phone, first_name, last_name, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      p_supabase_id,
      p_email,
      p_phone,
      COALESCE(NULLIF(TRIM(p_first_name), ''), 'User'),
      COALESCE(NULLIF(TRIM(p_last_name), ''), ''),
      now(),
      now()
    )
    RETURNING * INTO v_user;
  ELSE
    UPDATE users SET
      email = COALESCE(NULLIF(TRIM(p_email), ''), email),
      phone = COALESCE(NULLIF(TRIM(p_phone), ''), phone),
      first_name = CASE WHEN TRIM(p_first_name) <> '' THEN p_first_name ELSE first_name END,
      last_name = CASE WHEN TRIM(p_last_name) <> '' THEN p_last_name ELSE last_name END,
      updated_at = now()
    WHERE id = v_user.id
    RETURNING * INTO v_user;
  END IF;

  -- 2. Create company with slug collision handling
  v_base_slug := lower(regexp_replace(trim(p_company_name), '[^a-z0-9]+', '-', 'gi'));
  v_base_slug := trim(both '-' from v_base_slug);
  IF v_base_slug = '' THEN
    v_base_slug := 'company';
  END IF;

  v_slug := v_base_slug;

  -- Generate join code
  v_join_code := upper(substr(md5(random()::text), 1, 6));

  LOOP
    BEGIN
      INSERT INTO companies (id, name, slug, join_code, brand_color, timezone, settings, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        trim(p_company_name),
        v_slug,
        v_join_code,
        '#1d3451',
        'America/Los_Angeles',
        '{}'::jsonb,
        now(),
        now()
      )
      RETURNING * INTO v_company;
      EXIT; -- success
    EXCEPTION WHEN unique_violation THEN
      v_attempt := v_attempt + 1;
      IF v_attempt > 10 THEN
        RAISE EXCEPTION 'Could not create company: too many slug collisions';
      END IF;
      -- Append random suffix to make slug unique
      v_slug := v_base_slug || '-' || substr(md5(random()::text), 1, 4);
      v_join_code := upper(substr(md5(random()::text), 1, 6));
    END;
  END LOOP;

  -- 3. Create owner membership
  SELECT * INTO v_membership
    FROM company_memberships
    WHERE user_id = v_user.id
      AND company_id = v_company.id;

  IF NOT FOUND THEN
    INSERT INTO company_memberships (
      id, user_id, company_id, role, status,
      work_preferences, notification_days, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user.id,
      v_company.id,
      'owner',
      'active',
      '{}'::text[],
      ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun']::text[],
      now(),
      now()
    )
    RETURNING * INTO v_membership;
  END IF;

  -- Return combined result
  RETURN jsonb_build_object(
    'user', jsonb_build_object(
      'id', v_user.id,
      'supabase_id', v_user.supabase_id,
      'email', v_user.email,
      'phone', v_user.phone,
      'first_name', v_user.first_name,
      'last_name', v_user.last_name
    ),
    'company', jsonb_build_object(
      'id', v_company.id,
      'name', v_company.name,
      'slug', v_company.slug,
      'join_code', v_company.join_code
    ),
    'membership', jsonb_build_object(
      'id', v_membership.id,
      'role', v_membership.role,
      'status', v_membership.status
    )
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.create_company_with_owner TO authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
