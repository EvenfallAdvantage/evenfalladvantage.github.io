-- =============================================================================
-- LOCAL-ONLY stub of the OverwatchDB pieces touched by the RLS hardening
-- migration. Used to validate syntax and run tests/rls_hardening_test_plan.sql
-- against a throwaway Postgres (e.g. `createdb ow_rls_test`). NEVER run this
-- against a Supabase project: it creates roles, an auth.uid() stub and fake
-- storage tables.
-- Live policies below were copied from pg_policies on 2026-10-06.
-- =============================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
GRANT USAGE ON SCHEMA public, auth, storage, extensions TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
$$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, phone text);

CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean DEFAULT false);
CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id),
  name text NOT NULL,
  owner uuid,
  UNIQUE (bucket_id, name)
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE _parts text[];
BEGIN
  SELECT string_to_array(name, '/') INTO _parts;
  RETURN _parts[1:array_length(_parts, 1) - 1];
END $$;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO anon, authenticated, service_role;
INSERT INTO storage.buckets (id, name, public) VALUES
  ('certifications', 'certifications', true),
  ('operation-maps', 'operation-maps', true),
  ('applicant-documents', 'applicant-documents', false);

CREATE TYPE public."CompanyRole" AS ENUM ('owner', 'admin', 'instructor', 'manager', 'lead', 'breaker', 'staff', 'client');

CREATE TABLE public.users (
  id uuid PRIMARY KEY, email text UNIQUE, phone text UNIQUE, first_name text NOT NULL, last_name text NOT NULL,
  avatar_url text, supabase_id text UNIQUE, is_platform_admin boolean NOT NULL DEFAULT false,
  last_login_at timestamp, created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamp NOT NULL, callsign text
);
CREATE TABLE public.companies (
  id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE, logo_url text, join_code text NOT NULL UNIQUE,
  timezone text NOT NULL DEFAULT 'America/Los_Angeles', brand_color text NOT NULL DEFAULT '#6366f1',
  settings jsonb NOT NULL DEFAULT '{}', created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamp NOT NULL,
  website_url text, is_training_provider boolean NOT NULL DEFAULT false, accent_color text DEFAULT '#d59b3c',
  default_pay_rate numeric, default_bill_rate numeric, radio_state text
);
CREATE TABLE public.company_memberships (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role public."CompanyRole" NOT NULL DEFAULT 'staff', title text, nickname text, pronouns text, bio text,
  dietary_preferences text, shirt_size text, jacket_size text, guard_card_number text, guard_card_expiry timestamp,
  emergency_contact_name text, emergency_contact_phone text, address text, hire_date timestamp,
  status text NOT NULL DEFAULT 'active', work_preferences text[], whatsapp_opted_in boolean NOT NULL DEFAULT false,
  onboarding_complete boolean NOT NULL DEFAULT false, kiosk_pin text, qr_code_id text,
  notification_days text[] DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], notifications_muted boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamp NOT NULL, hide_contact_roster boolean DEFAULT false,
  education jsonb DEFAULT '[]', work_history jsonb DEFAULT '[]', dietary_restrictions text[] DEFAULT '{}',
  pay_rate_override numeric, radio_states text[] DEFAULT '{}',
  UNIQUE (user_id, company_id)
);
CREATE TABLE public.timesheets (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES public.users(id), shift_id uuid, clock_in timestamp NOT NULL,
  clock_out timestamp, clock_method text NOT NULL DEFAULT 'app', break_minutes integer NOT NULL DEFAULT 0,
  approved boolean NOT NULL DEFAULT false, approved_by_id uuid, approved_at timestamp, qb_synced boolean NOT NULL DEFAULT false,
  notes text, created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamp NOT NULL, event_id uuid,
  clock_in_type text DEFAULT 'shift', company_id uuid REFERENCES public.companies(id)
);
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES public.companies(id), user_id uuid, action text NOT NULL,
  entity_type text NOT NULL, entity_id text, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  event_type text, outcome text, ip_address text, user_agent text
);
CREATE TABLE public.join_attempts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), supabase_id text NOT NULL, attempted_at timestamptz NOT NULL DEFAULT now());

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.join_attempts ENABLE ROW LEVEL SECURITY;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- Live helper functions (verbatim bodies)
CREATE OR REPLACE FUNCTION public.get_my_user_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT id FROM public.users WHERE supabase_id = auth.uid()::text LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.is_company_member(comp_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.company_memberships cm JOIN public.users u ON u.id = cm.user_id
    WHERE u.supabase_id = auth.uid()::text AND cm.company_id = comp_id);
$$;
CREATE OR REPLACE FUNCTION public.is_company_admin(comp_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.company_memberships cm JOIN public.users u ON u.id = cm.user_id
    WHERE u.supabase_id = auth.uid()::text AND cm.company_id = comp_id AND cm.role IN ('owner', 'admin', 'manager'));
$$;
CREATE OR REPLACE FUNCTION public.operation_maps_company_for_object(object_name text) RETURNS uuid LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
  SELECT NULLIF(split_part(object_name, '/', 1), '')::uuid
$$;

-- Live policies (pg_policies, 2026-10-06)
CREATE POLICY "Admins can read company audit logs" ON public.audit_logs AS PERMISSIVE FOR SELECT TO authenticated USING ((company_id IN ( SELECT company_memberships.company_id FROM company_memberships WHERE ((company_memberships.user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) AND (company_memberships.role = ANY (ARRAY['owner'::"CompanyRole", 'admin'::"CompanyRole"]))))));
CREATE POLICY "Users can insert own audit logs" ON public.audit_logs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((user_id IS NULL) OR (user_id IN ( SELECT users.id FROM users WHERE (users.supabase_id = (( SELECT ( SELECT auth.uid() AS uid) AS uid))::text)))));
CREATE POLICY audit_logs_delete ON public.audit_logs AS PERMISSIVE FOR DELETE TO authenticated USING (is_company_admin(company_id));
CREATE POLICY audit_logs_insert ON public.audit_logs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id));
CREATE POLICY audit_logs_select ON public.audit_logs AS PERMISSIVE FOR SELECT TO authenticated USING (is_company_member(company_id));
CREATE POLICY audit_logs_update ON public.audit_logs AS PERMISSIVE FOR UPDATE TO authenticated USING (is_company_member(company_id));
CREATE POLICY companies_insert ON public.companies AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM users WHERE (users.supabase_id = (( SELECT ( SELECT auth.uid() AS uid) AS uid))::text))));
CREATE POLICY companies_select ON public.companies AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY companies_update ON public.companies AS PERMISSIVE FOR UPDATE TO authenticated USING (is_company_member(id));
CREATE POLICY memberships_delete ON public.company_memberships AS PERMISSIVE FOR DELETE TO authenticated USING ((company_id IN ( SELECT cm.company_id FROM (company_memberships cm JOIN users u ON ((u.id = cm.user_id))) WHERE ((u.supabase_id = (( SELECT ( SELECT auth.uid() AS uid) AS uid))::text) AND (cm.role = ANY (ARRAY['owner'::"CompanyRole", 'admin'::"CompanyRole"]))))));
CREATE POLICY memberships_insert ON public.company_memberships AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = get_my_user_id()));
CREATE POLICY memberships_select ON public.company_memberships AS PERMISSIVE FOR SELECT TO authenticated USING (is_company_member(company_id));
CREATE POLICY memberships_update ON public.company_memberships AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = get_my_user_id()));
CREATE POLICY join_attempts_delete ON public.join_attempts AS PERMISSIVE FOR DELETE TO authenticated USING ((supabase_id = (( SELECT ( SELECT auth.uid() AS uid) AS uid))::text));
CREATE POLICY join_attempts_insert ON public.join_attempts AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((supabase_id = (( SELECT ( SELECT auth.uid() AS uid) AS uid))::text));
CREATE POLICY join_attempts_select ON public.join_attempts AS PERMISSIVE FOR SELECT TO authenticated USING ((supabase_id = (( SELECT ( SELECT auth.uid() AS uid) AS uid))::text));
CREATE POLICY "Anyone can upload applicant documents" ON storage.objects AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK ((bucket_id = 'applicant-documents'::text));
CREATE POLICY "Anyone can view applicant documents" ON storage.objects AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((bucket_id = 'applicant-documents'::text));
CREATE POLICY "Authenticated users can delete applicant documents" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING ((bucket_id = 'applicant-documents'::text));
CREATE POLICY "Users can delete own certs" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'certifications'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Users can update own certs" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'certifications'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Users can upload own certs" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'certifications'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "operation-maps: managers can delete" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'operation-maps'::text) AND is_company_admin(operation_maps_company_for_object(name))));
CREATE POLICY "operation-maps: managers can update" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'operation-maps'::text) AND is_company_admin(operation_maps_company_for_object(name))));
CREATE POLICY "operation-maps: managers can upload" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'operation-maps'::text) AND is_company_admin(operation_maps_company_for_object(name))));
CREATE POLICY "operation-maps: members can read" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'operation-maps'::text) AND is_company_member(operation_maps_company_for_object(name))));
CREATE POLICY managers_delete_timesheets ON public.timesheets AS PERMISSIVE FOR DELETE TO public USING ((company_id IN ( SELECT cm.company_id FROM (company_memberships cm JOIN users u ON ((u.id = cm.user_id))) WHERE ((u.supabase_id = (( SELECT ( SELECT auth.uid() AS uid) AS uid))::text) AND (cm.role = ANY (ARRAY['manager'::"CompanyRole", 'admin'::"CompanyRole", 'owner'::"CompanyRole"]))))));
CREATE POLICY managers_insert_timesheets ON public.timesheets AS PERMISSIVE FOR INSERT TO public WITH CHECK ((company_id IN ( SELECT cm.company_id FROM (company_memberships cm JOIN users u ON ((u.id = cm.user_id))) WHERE ((u.supabase_id = (( SELECT ( SELECT auth.uid() AS uid) AS uid))::text) AND (cm.role = ANY (ARRAY['manager'::"CompanyRole", 'admin'::"CompanyRole", 'owner'::"CompanyRole"]))))));
CREATE POLICY timesheets_admin_select ON public.timesheets AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id IN ( SELECT cm.user_id FROM company_memberships cm WHERE ((cm.status = 'active'::text) AND (cm.company_id IN ( SELECT cm2.company_id FROM (company_memberships cm2 JOIN users u ON ((u.id = cm2.user_id))) WHERE ((u.supabase_id = (( SELECT ( SELECT auth.uid() AS uid) AS uid))::text) AND (cm2.status = 'active'::text) AND (cm2.role = ANY (ARRAY['owner'::"CompanyRole", 'admin'::"CompanyRole", 'manager'::"CompanyRole"])))))))));
CREATE POLICY timesheets_admin_update ON public.timesheets AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id IN ( SELECT cm.user_id FROM company_memberships cm WHERE ((cm.status = 'active'::text) AND (cm.company_id IN ( SELECT cm2.company_id FROM (company_memberships cm2 JOIN users u ON ((u.id = cm2.user_id))) WHERE ((u.supabase_id = (( SELECT ( SELECT auth.uid() AS uid) AS uid))::text) AND (cm2.status = 'active'::text) AND (cm2.role = ANY (ARRAY['owner'::"CompanyRole", 'admin'::"CompanyRole", 'manager'::"CompanyRole"])))))))));
CREATE POLICY timesheets_delete ON public.timesheets AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id IN ( SELECT users.id FROM users WHERE (users.supabase_id = (( SELECT ( SELECT auth.uid() AS uid) AS uid))::text))));
CREATE POLICY timesheets_insert ON public.timesheets AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = get_my_user_id()));
CREATE POLICY timesheets_select ON public.timesheets AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = get_my_user_id()));
CREATE POLICY timesheets_update ON public.timesheets AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = get_my_user_id()));
CREATE POLICY users_insert ON public.users AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((supabase_id = (( SELECT ( SELECT auth.uid() AS uid) AS uid))::text));
CREATE POLICY users_select ON public.users AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY users_update ON public.users AS PERMISSIVE FOR UPDATE TO authenticated USING ((supabase_id = (( SELECT ( SELECT auth.uid() AS uid) AS uid))::text));

-- Live RPC definitions (same text as the rollback file)
CREATE FUNCTION public.join_company_by_code(p_join_code text, p_supabase_id text, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_first_name text DEFAULT ''::text, p_last_name text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_company RECORD;
  v_user RECORD;
  v_membership RECORD;
  v_phone TEXT;
  v_attempt_count INT;
BEGIN
  -- ── Rate limit: max 5 attempts per 15 minutes per user ──
  -- Clean up old attempts first (older than 1 hour)
  DELETE FROM public.join_attempts
    WHERE supabase_id = p_supabase_id
      AND attempted_at < now() - interval '1 hour';

  -- Count recent attempts
  SELECT COUNT(*) INTO v_attempt_count
    FROM public.join_attempts
    WHERE supabase_id = p_supabase_id
      AND attempted_at > now() - interval '15 minutes';

  IF v_attempt_count >= 5 THEN
    RAISE EXCEPTION 'Too many join attempts. Please wait 15 minutes and try again.';
  END IF;

  -- Log this attempt
  INSERT INTO public.join_attempts (supabase_id) VALUES (p_supabase_id);

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
$function$;

CREATE FUNCTION public.create_company_with_owner(p_company_name text, p_supabase_id text, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_first_name text DEFAULT ''::text, p_last_name text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.create_roster_member(p_company_id uuid, p_first_name text, p_last_name text, p_email text, p_phone text DEFAULT NULL::text, p_role text DEFAULT 'staff'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_caller_supabase_id text;
  v_is_admin           boolean;
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

  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE u.supabase_id = v_caller_supabase_id
      AND cm.company_id = p_company_id
      AND cm.role IN ('owner', 'admin', 'manager')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
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
  IF p_role NOT IN (
    'owner', 'admin', 'instructor', 'manager', 'lead', 'breaker', 'staff', 'client'
  ) THEN
    RAISE EXCEPTION 'invalid role: %', p_role USING ERRCODE = '22023';
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
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
