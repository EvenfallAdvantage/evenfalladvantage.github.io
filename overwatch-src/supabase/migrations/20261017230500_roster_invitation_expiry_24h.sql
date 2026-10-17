-- Roster invitations: the invitation record expires 24 hours after it is (re)sent, instead of 7 days,
-- so roster_invitations.expires_at matches the emailed text ("This link expires in 24 hours", roster-invite v13).
-- OverwatchDB. DRAFT: not applied.
--
-- The function body is the live definition (read 2026-10-17 16:0x PT), with only the two intervals changed.
-- Owner, SECURITY DEFINER, search_path and the comment are unchanged. CREATE OR REPLACE keeps the existing grants
-- (EXECUTE: postgres, service_role only).
-- Not changed: the column default (now() + 7 days). Every write goes through this function with an explicit value.
-- Existing rows keep their expires_at. The 6 pending rows (another company) had all already expired when checked.
-- Rollback: migrations/rollback/20261017230500_roster_invitation_expiry_24h.rollback.sql
-- Test (rolled back): tests/roster_invitation_expiry_24h_rolledback_test.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.upsert_roster_invitation(p_company_id uuid, p_membership_id uuid, p_invitee_email text, p_invited_by uuid, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS roster_invitations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_row public.roster_invitations;
BEGIN
  INSERT INTO public.roster_invitations (
    company_id, membership_id, invitee_email, invited_by,
    sent_at, expires_at, metadata
  ) VALUES (
    p_company_id, p_membership_id, p_invitee_email, p_invited_by,
    now(), now() + INTERVAL '24 hours', p_metadata
  )
  ON CONFLICT (membership_id) DO UPDATE
  SET sent_at        = now(),
      expires_at     = now() + INTERVAL '24 hours',
      accepted_at    = NULL,
      revoked_at     = NULL,
      last_resent_at = CASE WHEN public.roster_invitations.id IS NULL
                            THEN NULL ELSE now() END,
      resend_count   = public.roster_invitations.resend_count + 1,
      invitee_email  = EXCLUDED.invitee_email,
      invited_by     = EXCLUDED.invited_by,
      metadata       = EXCLUDED.metadata
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

COMMIT;
