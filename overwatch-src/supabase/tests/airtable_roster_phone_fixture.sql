-- Isolated schema for applying 20261106223000 then 20261106234500.
-- Not a production migration. Tables are the columns those functions read
-- and write. users_phone_key is an exact btree on phone, matching production.

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT current_setting('request.jwt.claim.role', true);
$$;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE ROLE service_role NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TYPE public."CompanyRole" AS ENUM (
  'owner', 'admin', 'instructor', 'manager', 'lead', 'breaker', 'staff', 'client'
);

CREATE TABLE public.companies (
  id uuid PRIMARY KEY,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.users (
  id uuid PRIMARY KEY,
  supabase_id text,
  email text,
  phone text,
  first_name text,
  last_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_phone_key ON public.users (phone);
CREATE UNIQUE INDEX users_lower_email_uidx ON public.users (lower(email)) WHERE email IS NOT NULL;

CREATE TABLE public.company_memberships (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users (id),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  role public."CompanyRole" NOT NULL,
  status text NOT NULL,
  title text,
  work_preferences text[] NOT NULL DEFAULT '{}',
  notification_days text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id)
);

CREATE TABLE public.integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  provider text NOT NULL,
  status text NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (company_id, provider)
);

CREATE TABLE public.airtable_field_mappings (
  company_id uuid NOT NULL REFERENCES public.companies (id),
  purpose text NOT NULL,
  base_id text NOT NULL,
  table_id text NOT NULL,
  mappings jsonb NOT NULL DEFAULT '{}'::jsonb,
  confirmed_at timestamptz,
  PRIMARY KEY (company_id, purpose, base_id, table_id)
);

CREATE TABLE public.employee_external_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  user_id uuid NOT NULL REFERENCES public.users (id),
  provider text NOT NULL,
  external_employee_id text NOT NULL,
  match_method text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id, provider),
  UNIQUE (company_id, provider, external_employee_id)
);

-- Same predicate the live MFA migration installs. apply_airtable_roster_sync calls it.
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

REVOKE ALL ON FUNCTION public.assert_mfa_for_company(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_mfa_for_company(uuid) TO authenticated, service_role;

-- Explicit schema usage so a denied helper call is EXECUTE, not schema access.
GRANT USAGE ON SCHEMA public TO authenticated, anon;
