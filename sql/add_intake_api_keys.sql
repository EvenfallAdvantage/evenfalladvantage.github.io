-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  INTAKE API KEYS & FIELD MAPPINGS — May 14, 2026                 ║
-- ║                                                                   ║
-- ║  Lets companies (OpServe, etc.) keep their own custom forms on   ║
-- ║  their own websites and POST submissions into Overwatch via      ║
-- ║  an authenticated, rate-limited Edge Function:                   ║
-- ║                                                                   ║
-- ║     POST /functions/v1/intake-ingest                              ║
-- ║       Authorization: Bearer ova_live_<plain-key>                  ║
-- ║       Content-Type: application/json                              ║
-- ║       { ... any shape ... }                                       ║
-- ║                                                                   ║
-- ║  Adds:                                                            ║
-- ║   - api_keys              (per-company, hashed at rest)          ║
-- ║   - intake_field_mappings (per-company source→canonical fields)  ║
-- ║   - api_request_log       (sliding-window rate limiter)          ║
-- ║   - Extends client_intake_tokens with source, api_key_id,        ║
-- ║     raw_payload, submitted_at columns.                            ║
-- ║                                                                   ║
-- ║  Run in Supabase SQL Editor (Overwatch DB).                      ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ─── 1. api_keys ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                         -- human label, e.g. "OpServe Marketing Site"
  key_prefix TEXT NOT NULL,                   -- first 12 chars of plaintext, for display ("ova_live_a1b2")
  key_hash TEXT NOT NULL UNIQUE,              -- SHA-256 hex of the full plaintext key
  scopes TEXT[] NOT NULL DEFAULT ARRAY['intake:write']::text[],
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_company ON public.api_keys(company_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Managers can read keys for their company (key_hash is not the plaintext, safe to expose)
DROP POLICY IF EXISTS api_keys_manager_select ON public.api_keys;
CREATE POLICY api_keys_manager_select ON public.api_keys
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.company_id = api_keys.company_id
      AND u.supabase_id = auth.uid()::text
      AND cm.role IN ('owner', 'admin', 'manager')
  ));

-- Managers can create keys
DROP POLICY IF EXISTS api_keys_manager_insert ON public.api_keys;
CREATE POLICY api_keys_manager_insert ON public.api_keys
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.company_id = api_keys.company_id
      AND u.supabase_id = auth.uid()::text
      AND cm.role IN ('owner', 'admin', 'manager')
  ));

-- Managers can update (revoke) keys
DROP POLICY IF EXISTS api_keys_manager_update ON public.api_keys;
CREATE POLICY api_keys_manager_update ON public.api_keys
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.company_id = api_keys.company_id
      AND u.supabase_id = auth.uid()::text
      AND cm.role IN ('owner', 'admin', 'manager')
  ));

-- Managers can delete keys
DROP POLICY IF EXISTS api_keys_manager_delete ON public.api_keys;
CREATE POLICY api_keys_manager_delete ON public.api_keys
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.company_id = api_keys.company_id
      AND u.supabase_id = auth.uid()::text
      AND cm.role IN ('owner', 'admin', 'manager')
  ));

-- Note: the Edge Function uses the SERVICE ROLE key, which bypasses RLS,
-- so no anon SELECT policy is needed for key verification.

-- ─── 2. intake_field_mappings ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.intake_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_field TEXT NOT NULL,                 -- the key in the incoming JSON, e.g. "service"
  canonical_field TEXT NOT NULL               -- one of: client_name, client_email, client_phone,
                                              -- service, location, message, start_date, end_date,
                                              -- subject, notes (extensible)
    CHECK (canonical_field IN (
      'client_name', 'client_email', 'client_phone',
      'service', 'location', 'message',
      'start_date', 'end_date',
      'subject', 'notes'
    )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, source_field)
);

CREATE INDEX IF NOT EXISTS idx_intake_field_mappings_company
  ON public.intake_field_mappings(company_id);

ALTER TABLE public.intake_field_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS intake_field_mappings_manager_all ON public.intake_field_mappings;
CREATE POLICY intake_field_mappings_manager_all ON public.intake_field_mappings
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.company_id = intake_field_mappings.company_id
      AND u.supabase_id = auth.uid()::text
      AND cm.role IN ('owner', 'admin', 'manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.company_id = intake_field_mappings.company_id
      AND u.supabase_id = auth.uid()::text
      AND cm.role IN ('owner', 'admin', 'manager')
  ));

-- ─── 3. api_request_log (sliding-window rate limiter) ──────────────

CREATE TABLE IF NOT EXISTS public.api_request_log (
  id BIGSERIAL PRIMARY KEY,
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  status_code INT NOT NULL,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Critical index for sliding-window queries
CREATE INDEX IF NOT EXISTS idx_api_request_log_key_time
  ON public.api_request_log(api_key_id, created_at DESC);

ALTER TABLE public.api_request_log ENABLE ROW LEVEL SECURITY;

-- Managers can read their own logs
DROP POLICY IF EXISTS api_request_log_manager_select ON public.api_request_log;
CREATE POLICY api_request_log_manager_select ON public.api_request_log
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.api_keys ak
    JOIN public.company_memberships cm ON cm.company_id = ak.company_id
    JOIN public.users u ON u.id = cm.user_id
    WHERE ak.id = api_request_log.api_key_id
      AND u.supabase_id = auth.uid()::text
      AND cm.role IN ('owner', 'admin', 'manager')
  ));

-- Cleanup: drop log rows older than 30 days. Called from a cron or on-demand.
CREATE OR REPLACE FUNCTION public.api_request_log_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.api_request_log WHERE created_at < now() - INTERVAL '30 days';
END;
$$;

-- ─── 4. Extend client_intake_tokens ────────────────────────────────

ALTER TABLE public.client_intake_tokens
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'hosted'
    CHECK (source IN ('hosted', 'api', 'webhook'));

ALTER TABLE public.client_intake_tokens
  ADD COLUMN IF NOT EXISTS api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL;

ALTER TABLE public.client_intake_tokens
  ADD COLUMN IF NOT EXISTS raw_payload JSONB;

ALTER TABLE public.client_intake_tokens
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_client_intake_tokens_source_company
  ON public.client_intake_tokens(company_id, source, status);

-- API submissions don't require a created_by user; relax that NOT NULL.
-- For API submissions, created_by will be the company owner (best-effort) or NULL.
ALTER TABLE public.client_intake_tokens
  ALTER COLUMN created_by DROP NOT NULL;

-- ─── 5. Verify ──────────────────────────────────────────────────────

SELECT 'api_keys' AS table_name, COUNT(*)::bigint AS rows FROM public.api_keys
UNION ALL
SELECT 'intake_field_mappings', COUNT(*)::bigint FROM public.intake_field_mappings
UNION ALL
SELECT 'api_request_log', COUNT(*)::bigint FROM public.api_request_log
UNION ALL
SELECT 'client_intake_tokens (api source)', COUNT(*)::bigint
  FROM public.client_intake_tokens WHERE source = 'api'
UNION ALL
SELECT 'policies on api_keys', COUNT(*)::bigint
  FROM pg_policies WHERE tablename = 'api_keys'
UNION ALL
SELECT 'policies on intake_field_mappings', COUNT(*)::bigint
  FROM pg_policies WHERE tablename = 'intake_field_mappings'
UNION ALL
SELECT 'policies on api_request_log', COUNT(*)::bigint
  FROM pg_policies WHERE tablename = 'api_request_log';
-- Expected: 4 zeroes (no data yet) + policy counts 4, 1, 1
