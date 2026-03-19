-- ============================================================
-- FIX: users_phone_key unique constraint causing 409 errors
-- Run in: Supabase Dashboard → SQL Editor → New Query
--
-- Problem: Empty string '' in phone column conflicts with other
-- users who also have '' because of the unique constraint.
-- NULL is fine (Postgres allows multiple NULLs in unique cols)
-- but '' (empty string) is treated as a real value.
-- ============================================================

-- 1. Clean up: Convert empty string phones to NULL
UPDATE public.users SET phone = NULL WHERE phone = '';

-- 2. Drop the strict unique constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_phone_key;

-- 3. Create a partial unique index that only enforces uniqueness
--    for real phone numbers (not NULL, not empty string)
DROP INDEX IF EXISTS users_phone_unique;
CREATE UNIQUE INDEX users_phone_unique
  ON public.users (phone)
  WHERE phone IS NOT NULL AND phone <> '';

-- 4. Update the join_company_by_code RPC to normalize phone
CREATE OR REPLACE FUNCTION public.join_company_by_code(
  p_join_code TEXT,
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
  v_phone TEXT;
BEGIN
  -- Normalize phone: empty/whitespace → NULL
  v_phone := NULLIF(TRIM(COALESCE(p_phone, '')), '');

  -- 1. Find company by join code
  SELECT * INTO v_company
    FROM public.companies
    WHERE join_code = UPPER(TRIM(p_join_code));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid company code';
  END IF;

  -- 2. Find or create user
  SELECT * INTO v_user
    FROM public.users
    WHERE supabase_id = p_supabase_id;

  IF NOT FOUND THEN
    INSERT INTO public.users (id, supabase_id, email, phone, first_name, last_name, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      p_supabase_id,
      NULLIF(TRIM(COALESCE(p_email, '')), ''),
      v_phone,
      COALESCE(NULLIF(TRIM(p_first_name), ''), 'User'),
      COALESCE(NULLIF(TRIM(p_last_name), ''), ''),
      now(),
      now()
    )
    RETURNING * INTO v_user;
  ELSE
    -- Update non-empty fields only
    UPDATE public.users SET
      email = COALESCE(NULLIF(TRIM(p_email), ''), email),
      phone = COALESCE(v_phone, phone),
      first_name = CASE WHEN TRIM(p_first_name) <> '' THEN p_first_name ELSE first_name END,
      last_name = CASE WHEN TRIM(p_last_name) <> '' THEN p_last_name ELSE last_name END,
      updated_at = now()
    WHERE id = v_user.id
    RETURNING * INTO v_user;
  END IF;

  -- 3. Create membership (or return existing)
  SELECT * INTO v_membership
    FROM public.company_memberships
    WHERE user_id = v_user.id
      AND company_id = v_company.id;

  IF NOT FOUND THEN
    INSERT INTO public.company_memberships (
      id, user_id, company_id, role, status,
      work_preferences, notification_days, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user.id,
      v_company.id,
      'staff',
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
GRANT EXECUTE ON FUNCTION public.join_company_by_code TO authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
