-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  RPC: create_roster_member                                        ║
-- ║                                                                   ║
-- ║  Single-shot roster add: creates a public.users row (with         ║
-- ║  supabase_id = NULL, i.e. "unlinked") AND a company_memberships   ║
-- ║  row, atomically. The roster-invite Edge Function then takes the  ║
-- ║  returned membership_id and:                                      ║
-- ║    1. Calls supabase.auth.admin.generateLink({type:'invite'})     ║
-- ║       which creates the actual auth.users row + an action link.   ║
-- ║    2. Emails the invitee through the company's verified provider ║
-- ║       (or platform fallback) with the password-set link.          ║
-- ║                                                                   ║
-- ║  When the invitee opens the link and sets their password, the     ║
-- ║  /auth/update-password page calls accept_roster_invitation()      ║
-- ║  which links auth.users.id back to public.users.supabase_id.      ║
-- ║                                                                   ║
-- ║  Cross-company case: if a public.users row already exists with    ║
-- ║  the same email (case-insensitive), we REUSE it and just add a    ║
-- ║  new company_memberships row. The cross-company invite path in    ║
-- ║  roster-invite + accept_roster_invitation already handles the     ║
-- ║  "user already has an Overwatch account elsewhere" case.          ║
-- ║                                                                   ║
-- ║  RBAC: owner/admin/manager via is_company_admin().                ║
-- ║                                                                   ║
-- ║  Returns: { user_id uuid, membership_id uuid, existing_user bool }║
-- ║                                                                   ║
-- ║  Locked down with REVOKE PUBLIC + GRANT authenticated, matching   ║
-- ║  the pattern in fix_supabase_linter_warnings.                     ║
-- ╚══════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.create_roster_member(
  p_company_id   uuid,
  p_first_name   text,
  p_last_name    text,
  p_email        text,
  p_phone        text DEFAULT NULL,
  p_role         text DEFAULT 'staff'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_supabase_id text;
  v_is_admin           boolean;
  v_user_id            uuid;
  v_existing_user      boolean := false;
  v_membership_id      uuid;
  v_email_norm         text;
BEGIN
  -- ── Auth ──
  v_caller_supabase_id := auth.uid()::text;
  IF v_caller_supabase_id IS NULL OR v_caller_supabase_id = '' THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- ── RBAC: owner/admin/manager only (matches is_company_admin role set) ──
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

  -- ── Input validation ──
  IF p_first_name IS NULL OR length(trim(p_first_name)) = 0 THEN
    RAISE EXCEPTION 'first_name is required' USING ERRCODE = '22023';
  END IF;
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RAISE EXCEPTION 'email is required' USING ERRCODE = '22023';
  END IF;
  -- Basic email shape check (defense in depth — the client also validates).
  IF p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'email is not a valid address' USING ERRCODE = '22023';
  END IF;
  -- Must match the "CompanyRole" enum in the live DB exactly. Prisma's
  -- supabase-init.sql is the source of truth for this enum, not the older
  -- supabase-setup.sql which declares it as plain text.
  IF p_role NOT IN (
    'owner', 'admin', 'instructor', 'manager', 'lead', 'breaker', 'staff', 'client'
  ) THEN
    RAISE EXCEPTION 'invalid role: %', p_role USING ERRCODE = '22023';
  END IF;

  v_email_norm := lower(trim(p_email));

  -- ── Find or create the public.users row ──
  -- Match case-insensitively. If a row exists, we reuse it (cross-company
  -- add) regardless of whether it's linked to an auth user — the invite
  -- flow handles both linked and unlinked downstream.
  SELECT id INTO v_user_id
  FROM public.users
  WHERE lower(email) = v_email_norm
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    v_existing_user := true;
  ELSE
    v_user_id := gen_random_uuid();
    INSERT INTO public.users (
      id, email, first_name, last_name, phone,
      supabase_id, created_at, updated_at
    ) VALUES (
      v_user_id,
      v_email_norm,
      trim(p_first_name),
      COALESCE(trim(p_last_name), ''),
      NULLIF(trim(p_phone), ''),
      NULL,
      now(), now()
    );
  END IF;

  -- ── Insert the company_memberships row ──
  -- Tolerate duplicate (user already a member of this company) by no-oping
  -- and returning the existing membership_id so the caller can still kick
  -- off a re-invite.
  --
  -- Note: company_memberships.role is the "CompanyRole" Postgres enum (NOT
  -- plain text) — Prisma defines it with quoted PascalCase, so the cast
  -- has to use exact quoted casing. Without this cast Postgres rejects
  -- the insert with "column role is of type CompanyRole but expression is
  -- of type text", surfacing as a 400 to the client.
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
    'existing_user',  v_existing_user
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_roster_member(uuid, text, text, text, text, text)
  FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_roster_member(uuid, text, text, text, text, text)
  TO authenticated;

COMMENT ON FUNCTION public.create_roster_member(uuid, text, text, text, text, text) IS
  'Single-shot roster add. Owner/admin/manager-gated. Creates an unlinked '
  'public.users row (or reuses one matching the email case-insensitively) '
  'plus a company_memberships row in the target company. The roster-invite '
  'Edge Function then dispatches the actual invitation email.';
