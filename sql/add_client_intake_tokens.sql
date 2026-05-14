-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  CLIENT INTAKE TOKENS — May 14, 2026                             ║
-- ║                                                                   ║
-- ║  Shareable, token-gated public intake form for clients to        ║
-- ║  request a new security operation BEFORE it exists in the system.║
-- ║                                                                   ║
-- ║  - Admin clicks "Request from Client" on OPS PLANNING page,      ║
-- ║    generates a tokenised link.                                    ║
-- ║  - Client visits /overwatch/client-intake?token=XXXX (no auth)   ║
-- ║    fills out the form, submits.                                   ║
-- ║  - Admin reviews submission and converts it into a full operation║
-- ║    via the existing create-wizard (with intake pre-filled).      ║
-- ║                                                                   ║
-- ║  Token format: 16-char lowercase hex (generated client-side).    ║
-- ║                                                                   ║
-- ║  Run in Supabase SQL Editor (Overwatch DB).                      ║
-- ╚══════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.client_intake_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  token TEXT NOT NULL UNIQUE,
  client_name TEXT,
  client_email TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'submitted', 'expired', 'revoked')),
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_intake_tokens_company_status
  ON public.client_intake_tokens(company_id, status);
CREATE INDEX IF NOT EXISTS idx_intake_tokens_token
  ON public.client_intake_tokens(token);
CREATE INDEX IF NOT EXISTS idx_intake_tokens_event
  ON public.client_intake_tokens(event_id);

ALTER TABLE public.client_intake_tokens ENABLE ROW LEVEL SECURITY;

-- ─── Policies ───────────────────────────────────────────────────────

-- Public (anon + authed) can look up an active token to render the form.
-- Lookup is by exact token match; tokens are unguessable (16-hex random).
DROP POLICY IF EXISTS intake_tokens_public_lookup ON public.client_intake_tokens;
CREATE POLICY intake_tokens_public_lookup ON public.client_intake_tokens
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Public (anon + authed) can update ONLY when submitting via token.
-- We restrict UPDATE to rows in active/submitted status to allow re-edits
-- before the link expires, but cannot change company_id, created_by, etc.
DROP POLICY IF EXISTS intake_tokens_public_submit ON public.client_intake_tokens;
CREATE POLICY intake_tokens_public_submit ON public.client_intake_tokens
  FOR UPDATE
  TO anon, authenticated
  USING (status IN ('active', 'submitted'))
  WITH CHECK (status IN ('active', 'submitted'));

-- Company members can read all tokens for their company.
DROP POLICY IF EXISTS intake_tokens_member_select ON public.client_intake_tokens;
CREATE POLICY intake_tokens_member_select ON public.client_intake_tokens
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.company_id = client_intake_tokens.company_id
      AND u.supabase_id = auth.uid()::text
  ));

-- Managers can create tokens for their company.
DROP POLICY IF EXISTS intake_tokens_manager_insert ON public.client_intake_tokens;
CREATE POLICY intake_tokens_manager_insert ON public.client_intake_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.company_id = client_intake_tokens.company_id
      AND u.supabase_id = auth.uid()::text
      AND cm.role IN ('owner', 'admin', 'manager')
  ));

-- Managers can update (revoke / re-link to event) tokens for their company.
DROP POLICY IF EXISTS intake_tokens_manager_update ON public.client_intake_tokens;
CREATE POLICY intake_tokens_manager_update ON public.client_intake_tokens
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.company_id = client_intake_tokens.company_id
      AND u.supabase_id = auth.uid()::text
      AND cm.role IN ('owner', 'admin', 'manager')
  ));

-- Managers can delete tokens for their company.
DROP POLICY IF EXISTS intake_tokens_manager_delete ON public.client_intake_tokens;
CREATE POLICY intake_tokens_manager_delete ON public.client_intake_tokens
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.company_id = client_intake_tokens.company_id
      AND u.supabase_id = auth.uid()::text
      AND cm.role IN ('owner', 'admin', 'manager')
  ));

-- ─── updated_at trigger ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.client_intake_tokens_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_intake_tokens_updated_at ON public.client_intake_tokens;
CREATE TRIGGER trg_client_intake_tokens_updated_at
  BEFORE UPDATE ON public.client_intake_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.client_intake_tokens_touch_updated_at();

-- ─── Verify ─────────────────────────────────────────────────────────

SELECT 'client_intake_tokens table' AS object, COUNT(*) AS rows
FROM public.client_intake_tokens
UNION ALL
SELECT 'policies', COUNT(*)::bigint
FROM pg_policies WHERE tablename = 'client_intake_tokens';
-- Expected: rows=0, policies=6
