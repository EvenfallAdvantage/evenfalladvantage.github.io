-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  ROSTER INVITATIONS                                               ║
-- ║                                                                   ║
-- ║  Tracks invitations sent from the Roster tab to roster members    ║
-- ║  who don't yet have a Supabase Auth account (users.supabase_id    ║
-- ║  IS NULL).                                                        ║
-- ║                                                                   ║
-- ║  The actual auth side of the invite is handled by                 ║
-- ║  supabase.auth.admin.generateLink({ type: 'invite' }) inside the  ║
-- ║  roster-invite Edge Function. This table is the application-side  ║
-- ║  shadow: status (sent / accepted / revoked / expired), resend     ║
-- ║  count, audit trail, idempotency.                                 ║
-- ╚══════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS roster_invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  membership_id   UUID NOT NULL REFERENCES company_memberships(id) ON DELETE CASCADE,
  invitee_email   TEXT NOT NULL,
  invited_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at     TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  last_resent_at  TIMESTAMPTZ,
  resend_count    INT NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}',
  UNIQUE(membership_id)
);

CREATE INDEX IF NOT EXISTS idx_roster_invitations_company
  ON roster_invitations(company_id);
CREATE INDEX IF NOT EXISTS idx_roster_invitations_email
  ON roster_invitations(invitee_email);
CREATE INDEX IF NOT EXISTS idx_roster_invitations_pending
  ON roster_invitations(company_id)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

ALTER TABLE roster_invitations ENABLE ROW LEVEL SECURITY;

-- Admins/managers/owners of the company can see invitations.
DROP POLICY IF EXISTS roster_invitations_select ON roster_invitations;
CREATE POLICY roster_invitations_select ON roster_invitations
  FOR SELECT TO authenticated
  USING (public.is_company_admin(company_id));

-- All writes go through the roster-invite Edge Function with service-role
-- key. No client INSERT/UPDATE/DELETE policy is granted.

COMMENT ON TABLE roster_invitations IS
  'Application-side shadow of Supabase Auth invitations for roster members. '
  'Tracks sent/accepted/revoked/expired + resend history for the Roster tab UI.';

-- ── Atomic upsert helper used by the roster-invite Edge Function. ──
-- Service-role-only. Inserts a new row (resend_count=0) or, when the
-- membership already has an invitation row, updates timestamps and
-- atomically increments resend_count. Returns the resulting row.
CREATE OR REPLACE FUNCTION public.upsert_roster_invitation(
  p_company_id    uuid,
  p_membership_id uuid,
  p_invitee_email text,
  p_invited_by    uuid,
  p_metadata      jsonb DEFAULT '{}'::jsonb
)
RETURNS public.roster_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_roster_invitation(uuid, uuid, text, uuid, jsonb)
  FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.upsert_roster_invitation(uuid, uuid, text, uuid, jsonb)
  TO service_role;

COMMENT ON FUNCTION public.upsert_roster_invitation(uuid, uuid, text, uuid, jsonb) IS
  'Service-role-only. Inserts a fresh invitation or, on conflict, refreshes timestamps and atomically increments resend_count.';
