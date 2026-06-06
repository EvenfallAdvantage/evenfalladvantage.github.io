-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  RPC: accept_roster_invitation                                    ║
-- ║                                                                   ║
-- ║  Called from /auth/update-password after a newly-invited user     ║
-- ║  sets their password and a Supabase session exists. The RPC       ║
-- ║  reads the caller's auth.uid() + email and:                       ║
-- ║                                                                   ║
-- ║    1. Looks for a public.users row with matching email and        ║
-- ║       supabase_id IS NULL (the "imported but no auth account"     ║
-- ║       state created by convert_applicant_to_roster).              ║
-- ║       If found → link it: set supabase_id = caller, mark any      ║
-- ║       open roster_invitations row as accepted.                    ║
-- ║                                                                   ║
-- ║    2. If a users row already exists with the same email but is    ║
-- ║       linked to a DIFFERENT supabase user (i.e. the invitee       ║
-- ║       already has an Overwatch account in another company), we   ║
-- ║       look for the most-recent open roster_invitations row for    ║
-- ║       this email and create the new company_memberships entry     ║
-- ║       for the EXISTING users.id pointed to by their existing      ║
-- ║       supabase_id. (Cross-company invite path — decision #2.)     ║
-- ║                                                                   ║
-- ║    3. Otherwise → no-op (the user signed in via a regular        ║
-- ║       password-reset link, no invitation pending).                ║
-- ║                                                                   ║
-- ║  Returns JSON with the action taken so the client can render a   ║
-- ║  contextual welcome message.                                      ║
-- ║                                                                   ║
-- ║  SECURITY DEFINER + REVOKE PUBLIC + GRANT authenticated to follow ║
-- ║  the linter pattern established in fix_supabase_linter_warnings.  ║
-- ╚══════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.accept_roster_invitation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
  SELECT email INTO v_caller_email
  FROM auth.users
  WHERE id::text = v_caller_supabase_id;

  IF v_caller_email IS NULL THEN
    RETURN jsonb_build_object('action', 'no_email');
  END IF;

  -- ── Case 1: unlinked roster user with matching email ──
  SELECT id INTO v_unlinked_user_id
  FROM public.users
  WHERE lower(email) = lower(v_caller_email)
    AND supabase_id IS NULL
  LIMIT 1;

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
$$;

-- Lock down EXECUTE: revoke the Postgres default (PUBLIC) then grant only
-- to authenticated callers. This is the RPC the /auth/update-password page
-- invokes after a session is established.
REVOKE EXECUTE ON FUNCTION public.accept_roster_invitation() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.accept_roster_invitation() TO authenticated;

COMMENT ON FUNCTION public.accept_roster_invitation() IS
  'Called after a newly-invited user sets their password. Links the auth '
  'user to an unlinked roster users row (case 1), or adds a cross-company '
  'membership for an already-linked user (case 2). Returns action taken.';
