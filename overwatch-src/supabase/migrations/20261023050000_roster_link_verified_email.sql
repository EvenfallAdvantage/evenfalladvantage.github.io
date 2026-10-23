-- 20261023050000_roster_link_verified_email
-- Guardians onboarding fix: a pre-rostered agent (public.users row with
-- supabase_id NULL, created by create_roster_member) who signs up on their
-- own / uses the join code / signs in without the invite link previously hit
-- users_email_key and was stranded with no company.
--  * accept_roster_invitation(): case 1 now requires auth.users.email_confirmed_at
--    and that the caller has no linked profile yet. Called by the app on
--    profile load (fetchUserProfile) as well as on /auth/update-password.
--  * join_company_by_code(): links the unlinked roster row by VERIFIED auth
--    email before creating a new users row. Existing memberships keep their
--    role; new memberships are still 'staff' (#45 rules unchanged).
-- Identity always comes from auth.uid() + auth.users (never caller input).
-- Rollback: rollback/20261023050000_roster_link_verified_email.rollback.sql
BEGIN;
CREATE OR REPLACE FUNCTION public.accept_roster_invitation()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_caller_supabase_id text;
  v_caller_email       text;
  v_unlinked_user_id   uuid;
  v_existing_user_id   uuid;
  v_invitation         record;
  v_membership_id      uuid;
  v_result             jsonb;
BEGIN
  v_caller_supabase_id := auth.uid()::text;
  IF v_caller_supabase_id IS NULL OR v_caller_supabase_id = '' THEN
    RETURN jsonb_build_object('action', 'no_session');
  END IF;

  -- Pull the caller's email from auth.users. We trust it because the row
  -- is created by Supabase Auth on signup/invite and was either verified
  -- via the invite link or marked email_confirm=true by the admin invite.
  -- Only a VERIFIED auth email may claim a roster row (20261023050000).
  SELECT email INTO v_caller_email
  FROM auth.users
  WHERE id::text = v_caller_supabase_id
    AND email_confirmed_at IS NOT NULL;

  IF v_caller_email IS NULL THEN
    RETURN jsonb_build_object('action', 'email_not_verified');
  END IF;

  -- ── Case 1: unlinked roster user with matching email ──
  -- Only when the caller has no linked profile yet (avoids a
  -- users_supabase_id_key violation / double-linking).
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE supabase_id = v_caller_supabase_id) THEN
    SELECT id INTO v_unlinked_user_id
    FROM public.users
    WHERE lower(email) = lower(v_caller_email)
      AND supabase_id IS NULL
    LIMIT 1;
  END IF;

  IF v_unlinked_user_id IS NOT NULL THEN
    UPDATE public.users
    SET supabase_id = v_caller_supabase_id,
        updated_at  = now()
    WHERE id = v_unlinked_user_id;

    UPDATE public.roster_invitations
    SET accepted_at = now()
    WHERE membership_id IN (
      SELECT id FROM public.company_memberships WHERE user_id = v_unlinked_user_id
    )
    AND accepted_at IS NULL
    AND revoked_at IS NULL;

    v_result := jsonb_build_object(
      'action', 'linked_existing',
      'user_id', v_unlinked_user_id
    );
    RETURN v_result;
  END IF;

  -- ── Case 2: cross-company invite — user exists already in another company ──
  -- Find the most-recent open invitation for this email. If one exists,
  -- and there's a users row already linked to a DIFFERENT supabase id,
  -- we add a company_memberships row for that existing user under the
  -- inviting company. (Per decision #2: silent add + confirmation email.)
  SELECT * INTO v_invitation
  FROM public.roster_invitations
  WHERE lower(invitee_email) = lower(v_caller_email)
    AND accepted_at IS NULL
    AND revoked_at IS NULL
    AND expires_at > now()
  ORDER BY sent_at DESC
  LIMIT 1;

  IF v_invitation.id IS NOT NULL THEN
    -- Look up the existing linked user via their supabase_id.
    SELECT id INTO v_existing_user_id
    FROM public.users
    WHERE supabase_id = v_caller_supabase_id
    LIMIT 1;

    IF v_existing_user_id IS NOT NULL THEN
      -- Look up the original membership_id from the invitation. That row
      -- already exists but points at the *unlinked* users row for this
      -- company. We need to redirect the membership to the existing
      -- (already-linked) user instead.
      UPDATE public.company_memberships
      SET user_id = v_existing_user_id,
          updated_at = now()
      WHERE id = v_invitation.membership_id
      RETURNING id INTO v_membership_id;

      -- If the redirect worked (membership existed), delete the orphaned
      -- placeholder users row so we don't accumulate duplicates.
      DELETE FROM public.users
      WHERE lower(email) = lower(v_caller_email)
        AND supabase_id IS NULL
        AND id NOT IN (
          SELECT user_id FROM public.company_memberships
        );

      UPDATE public.roster_invitations
      SET accepted_at = now()
      WHERE id = v_invitation.id;

      RETURN jsonb_build_object(
        'action', 'cross_company_added',
        'user_id', v_existing_user_id,
        'company_id', v_invitation.company_id,
        'membership_id', v_membership_id
      );
    END IF;
  END IF;

  -- ── Case 3: nothing to do (regular login or expired invite) ──
  RETURN jsonb_build_object('action', 'no_invitation');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.join_company_by_code(p_join_code text, p_supabase_id text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_first_name text DEFAULT ''::text, p_last_name text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid text;
  v_auth_email text;
  v_confirmed boolean := false;
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
  SELECT NULLIF(lower(trim(email)), ''), (email_confirmed_at IS NOT NULL)
    INTO v_auth_email, v_confirmed
    FROM auth.users WHERE id = v_uid::uuid;

  -- 2. Find or create user (keyed on auth.uid())
  SELECT * INTO v_user FROM public.users WHERE supabase_id = v_uid;
  IF NOT FOUND AND v_auth_email IS NOT NULL THEN
    -- 2a. Pre-rostered agent (admin-added, never signed in): claim the
    --     unlinked row ONLY with a verified auth email. Existing
    --     memberships/roles are kept as-is (no escalation, no duplicate).
    IF EXISTS (SELECT 1 FROM public.users WHERE lower(email) = v_auth_email AND supabase_id IS NULL) THEN
      IF NOT v_confirmed THEN
        RETURN jsonb_build_object('error', 'Please confirm your email address, then try again.');
      END IF;
      UPDATE public.users SET supabase_id = v_uid, updated_at = now()
        WHERE id = (SELECT id FROM public.users
                     WHERE lower(email) = v_auth_email AND supabase_id IS NULL LIMIT 1)
        RETURNING * INTO v_user;
      UPDATE public.roster_invitations SET accepted_at = now()
        WHERE membership_id IN (SELECT id FROM public.company_memberships WHERE user_id = v_user.id)
          AND accepted_at IS NULL AND revoked_at IS NULL;
    END IF;
  END IF;
  IF v_user.id IS NULL THEN
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
$function$


;

REVOKE ALL ON FUNCTION public.accept_roster_invitation() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_company_by_code(text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_roster_invitation() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_company_by_code(text,text,text,text,text,text) TO authenticated, service_role;
-- No new tables; table privileges (TRUNCATE/REFERENCES/TRIGGER revoked) unchanged.
COMMIT;
