-- RPC function to convert a hired applicant into a roster member.
-- Runs with SECURITY DEFINER to bypass RLS on users/company_memberships tables.
-- Only callable by company managers (checked inside the function).
--
-- Run this in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION convert_applicant_to_roster(
  p_applicant_id uuid,
  p_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_applicant record;
  v_existing_user_id uuid;
  v_new_user_id uuid;
  v_user_id uuid;
  v_is_manager boolean;
BEGIN
  -- Check caller is a manager in this company
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

  -- Get applicant
  SELECT * INTO v_applicant FROM public.applicants WHERE id = p_applicant_id;
  IF v_applicant IS NULL THEN
    RAISE EXCEPTION 'Applicant not found';
  END IF;

  -- Check if user with this email already exists
  SELECT id INTO v_existing_user_id FROM public.users WHERE email = v_applicant.email LIMIT 1;

  IF v_existing_user_id IS NOT NULL THEN
    v_user_id := v_existing_user_id;
  ELSE
    -- Create new user record
    v_new_user_id := gen_random_uuid();
    INSERT INTO public.users (id, email, first_name, last_name, phone, created_at, updated_at)
    VALUES (
      v_new_user_id,
      v_applicant.email,
      v_applicant.first_name,
      v_applicant.last_name,
      v_applicant.phone,
      now(),
      now()
    );
    v_user_id := v_new_user_id;
  END IF;

  -- Create or update company membership
  INSERT INTO public.company_memberships (
    id, user_id, company_id, role, status, 
    guard_card_number, guard_card_expiry, address,
    work_preferences, hire_date, onboarding_complete,
    created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_user_id, p_company_id, 'staff', 'active',
    v_applicant.guard_card_number, v_applicant.guard_card_expiry, v_applicant.address,
    COALESCE(v_applicant.work_preferences, '[]'::jsonb), now(), true,
    now(), now()
  )
  ON CONFLICT (user_id, company_id) DO UPDATE SET
    status = 'active',
    role = 'staff',
    onboarding_complete = true,
    updated_at = now();

  -- Mark applicant as converted
  UPDATE public.applicants
  SET converted_user_id = v_user_id,
      status = 'hired',
      hired_at = COALESCE(hired_at, now()),
      updated_at = now()
  WHERE id = p_applicant_id;

  RETURN jsonb_build_object('user_id', v_user_id, 'existing', v_existing_user_id IS NOT NULL);
END;
$$;

-- Lock down EXECUTE: revoke the Postgres default (which grants to PUBLIC,
-- letting anon execute the function) then grant only to authenticated.
REVOKE EXECUTE ON FUNCTION public.convert_applicant_to_roster(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.convert_applicant_to_roster(uuid, uuid) TO authenticated;
