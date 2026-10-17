-- Rollback for 20261017230420_roster_invitation_expiry_24h.sql: restores the live 7-day definition (as read 2026-10-17).
-- Rows written while the 24h version was live keep their 24h expires_at.
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
    now(), now() + INTERVAL '7 days', p_metadata
  )
  ON CONFLICT (membership_id) DO UPDATE
  SET sent_at        = now(),
      expires_at     = now() + INTERVAL '7 days',
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
