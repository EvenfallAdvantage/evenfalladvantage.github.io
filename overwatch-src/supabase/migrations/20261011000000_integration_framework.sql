-- =============================================================================
-- 20261011000000_integration_framework.sql   (PR V0, vendor integration framework)
-- Target: OverwatchDB (project nneueuvyeohwnspbwfub) ONLY.
-- Status: NOT APPLIED (draft). Apply AFTER the integration-* Edge Functions are
--         deployed (they tolerate the tables being absent only for reads).
-- Rollback: rollback/20261011000000_integration_framework.rollback.sql
--
-- New tables (all company-scoped, RLS on):
--   integration_connections   one row per (company, provider); secrets live in
--                             Vault (vault_secret_id), never readable by clients
--   integration_oauth_states  OAuth state + PKCE verifier; service_role only
--   integration_events        inbound webhooks, idempotent on (provider, external_event_id)
--   integration_jobs          outbound work queue with retries/backoff
--   employee_external_ids     (company, user, provider) -> vendor employee id
--
-- Role rules:
--   owner/admin  read connections/events/jobs, edit connection `settings`,
--                manage employee_external_ids
--   manager      read-only (connections, jobs, external ids; NOT webhook payloads)
--   everyone else / anon: nothing
--   All status/credential/token writes go through Edge Functions (service_role).
--
-- Payroll decision #2: at most one ACTIVE payroll provider per company
-- (gusto / quickbooks / adp / paychex) via a partial unique index.
-- =============================================================================

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.integrations_config') IS NULL
     OR to_regclass('vault.secrets') IS NULL
     OR to_regprocedure('public.is_company_owner_admin(uuid)') IS NULL
     OR to_regprocedure('public.is_company_admin(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Wrong database: this migration is for OverwatchDB (nneueuvyeohwnspbwfub)';
  END IF;
END
$guard$;

-- ── integration_connections ─────────────────────────────────────────────────
CREATE TABLE public.integration_connections (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider            text NOT NULL CHECK (provider ~ '^[a-z][a-z0-9_]{1,31}$'),
  status              text NOT NULL DEFAULT 'disconnected'
                        CHECK (status IN ('disconnected','pending','connected','error','revoked')),
  auth_type           text NOT NULL
                        CHECK (auth_type IN ('oauth_code','oauth_client_credentials','api_key','partner_link')),
  vault_secret_id     uuid,
  access_expires_at   timestamptz,
  external_account_id text,
  external_account_name text,
  settings            jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(settings) = 'object'),
  last_test_at        timestamptz,
  last_test_ok        boolean,
  last_error          text,
  last_sync_at        timestamptz,
  last_webhook_at     timestamptz,
  refresh_failures    integer NOT NULL DEFAULT 0,
  refresh_lock_until  timestamptz,
  refresh_lock_token  uuid,
  connected_by        uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, provider)
);
CREATE UNIQUE INDEX integration_connections_one_payroll
  ON public.integration_connections (company_id)
  WHERE provider IN ('gusto','quickbooks','adp','paychex') AND status IN ('pending','connected','error');
CREATE INDEX integration_connections_expiring
  ON public.integration_connections (access_expires_at)
  WHERE status = 'connected' AND access_expires_at IS NOT NULL;
CREATE INDEX integration_connections_external
  ON public.integration_connections (provider, external_account_id);

-- ── integration_oauth_states (service_role only) ────────────────────────────
CREATE TABLE public.integration_oauth_states (
  state          text PRIMARY KEY CHECK (length(state) >= 32),
  company_id     uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider       text NOT NULL,
  user_id        uuid REFERENCES public.users(id) ON DELETE CASCADE,
  code_verifier  text,
  redirect_after text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  used_at        timestamptz
);
CREATE INDEX integration_oauth_states_expires ON public.integration_oauth_states (expires_at);

-- ── integration_events (inbound webhooks) ───────────────────────────────────
CREATE TABLE public.integration_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider          text NOT NULL,
  company_id        uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  connection_id     uuid REFERENCES public.integration_connections(id) ON DELETE SET NULL,
  external_event_id text NOT NULL,
  type              text,
  received_at       timestamptz NOT NULL DEFAULT now(),
  signature_ok      boolean NOT NULL,
  payload           jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at      timestamptz,
  attempts          integer NOT NULL DEFAULT 0,
  error             text,
  UNIQUE (provider, external_event_id)
);
CREATE INDEX integration_events_company ON public.integration_events (company_id, received_at DESC);
CREATE INDEX integration_events_unprocessed ON public.integration_events (received_at) WHERE processed_at IS NULL;

-- ── integration_jobs (outbound queue) ───────────────────────────────────────
CREATE TABLE public.integration_jobs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  connection_id  uuid REFERENCES public.integration_connections(id) ON DELETE CASCADE,
  provider       text NOT NULL,
  kind           text NOT NULL,
  idempotency_key text,
  payload        jsonb NOT NULL DEFAULT '{}'::jsonb,
  status         text NOT NULL DEFAULT 'queued'
                   CHECK (status IN ('queued','running','succeeded','failed','dead','cancelled')),
  attempts       integer NOT NULL DEFAULT 0,
  max_attempts   integer NOT NULL DEFAULT 6 CHECK (max_attempts BETWEEN 1 AND 20),
  next_run_at    timestamptz NOT NULL DEFAULT now(),
  locked_at      timestamptz,
  result         jsonb,
  last_error     text,
  created_by     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, provider, idempotency_key)
);
CREATE INDEX integration_jobs_due ON public.integration_jobs (next_run_at) WHERE status IN ('queued','failed');
CREATE INDEX integration_jobs_company ON public.integration_jobs (company_id, created_at DESC);

-- ── employee_external_ids ───────────────────────────────────────────────────
CREATE TABLE public.employee_external_ids (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id              uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider             text NOT NULL,
  external_employee_id text NOT NULL,
  match_method         text NOT NULL DEFAULT 'manual' CHECK (match_method IN ('manual','email','import')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id, provider),
  UNIQUE (company_id, provider, external_employee_id)
);

-- ── updated_at ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.integration_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $fn$
BEGIN NEW.updated_at := now(); RETURN NEW; END
$fn$;
CREATE TRIGGER integration_connections_touch BEFORE UPDATE ON public.integration_connections
  FOR EACH ROW EXECUTE FUNCTION public.integration_touch_updated_at();
CREATE TRIGGER integration_jobs_touch BEFORE UPDATE ON public.integration_jobs
  FOR EACH ROW EXECUTE FUNCTION public.integration_touch_updated_at();
CREATE TRIGGER employee_external_ids_touch BEFORE UPDATE ON public.employee_external_ids
  FOR EACH ROW EXECUTE FUNCTION public.integration_touch_updated_at();

-- ── Privileges + RLS ────────────────────────────────────────────────────────
ALTER TABLE public.integration_connections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_jobs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_external_ids    ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.integration_connections, public.integration_oauth_states, public.integration_events,
              public.integration_jobs, public.employee_external_ids FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.integration_connections, public.integration_oauth_states, public.integration_events,
             public.integration_jobs, public.employee_external_ids TO service_role;

-- connections: column-level SELECT (no vault_secret_id / lock columns), UPDATE of settings only.
GRANT SELECT (id, company_id, provider, status, auth_type, access_expires_at, external_account_id,
              external_account_name, settings, last_test_at, last_test_ok, last_error, last_sync_at,
              last_webhook_at, refresh_failures, connected_by, created_at, updated_at)
  ON public.integration_connections TO authenticated;
GRANT UPDATE (settings) ON public.integration_connections TO authenticated;
CREATE POLICY integration_connections_select ON public.integration_connections
  FOR SELECT TO authenticated USING (public.is_company_admin(company_id));
CREATE POLICY integration_connections_update ON public.integration_connections
  FOR UPDATE TO authenticated
  USING (public.is_company_owner_admin(company_id))
  WITH CHECK (public.is_company_owner_admin(company_id));

-- oauth states: no client grants, no policies (service_role bypasses RLS).

-- events: owner/admin read (payloads are redacted before insert, but still owner/admin only).
GRANT SELECT ON public.integration_events TO authenticated;
CREATE POLICY integration_events_select ON public.integration_events
  FOR SELECT TO authenticated USING (company_id IS NOT NULL AND public.is_company_owner_admin(company_id));

-- jobs: managers+ read; writes via integration-action / worker only.
GRANT SELECT ON public.integration_jobs TO authenticated;
CREATE POLICY integration_jobs_select ON public.integration_jobs
  FOR SELECT TO authenticated USING (public.is_company_admin(company_id));

-- external ids: managers+ read, owner/admin write; the user must belong to the company.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_external_ids TO authenticated;
CREATE POLICY employee_external_ids_select ON public.employee_external_ids
  FOR SELECT TO authenticated USING (public.is_company_admin(company_id));
CREATE POLICY employee_external_ids_write ON public.employee_external_ids
  FOR ALL TO authenticated
  USING (public.is_company_owner_admin(company_id))
  WITH CHECK (
    public.is_company_owner_admin(company_id)
    AND EXISTS (SELECT 1 FROM public.company_memberships cm
                WHERE cm.company_id = employee_external_ids.company_id
                  AND cm.user_id = employee_external_ids.user_id)
  );

-- ── Service-role RPCs ───────────────────────────────────────────────────────
-- Per-connection refresh lease (PostgREST RPCs are one transaction each, so an
-- advisory xact lock would not survive the vendor call). Returns a token when
-- acquired, NULL when another refresher holds it.
CREATE OR REPLACE FUNCTION public.integration_acquire_refresh_lock(p_connection_id uuid, p_ttl_seconds integer DEFAULT 60)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE tok uuid := gen_random_uuid();
BEGIN
  UPDATE public.integration_connections
     SET refresh_lock_until = now() + make_interval(secs => greatest(5, least(p_ttl_seconds, 300))),
         refresh_lock_token = tok
   WHERE id = p_connection_id
     AND (refresh_lock_until IS NULL OR refresh_lock_until < now());
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN tok;
END
$fn$;

CREATE OR REPLACE FUNCTION public.integration_release_refresh_lock(p_connection_id uuid, p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  UPDATE public.integration_connections
     SET refresh_lock_until = NULL, refresh_lock_token = NULL
   WHERE id = p_connection_id AND refresh_lock_token = p_token;
  RETURN FOUND;
END
$fn$;

-- Claim due jobs without double-processing (SKIP LOCKED).
CREATE OR REPLACE FUNCTION public.integration_claim_jobs(p_limit integer DEFAULT 10)
RETURNS SETOF public.integration_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  -- Recover jobs stuck in running for > 10 minutes (worker crashed).
  UPDATE public.integration_jobs SET status = 'failed', locked_at = NULL, last_error = 'worker timeout'
   WHERE status = 'running' AND locked_at < now() - interval '10 minutes';
  RETURN QUERY
  UPDATE public.integration_jobs j
     SET status = 'running', locked_at = now(), attempts = j.attempts + 1
   WHERE j.id IN (
     SELECT id FROM public.integration_jobs
      WHERE status IN ('queued','failed') AND next_run_at <= now() AND attempts < max_attempts
      ORDER BY next_run_at
      LIMIT greatest(1, least(p_limit, 50))
      FOR UPDATE SKIP LOCKED)
  RETURNING j.*;
END
$fn$;

REVOKE ALL ON FUNCTION public.integration_acquire_refresh_lock(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.integration_release_refresh_lock(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.integration_claim_jobs(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.integration_touch_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.integration_acquire_refresh_lock(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.integration_release_refresh_lock(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.integration_claim_jobs(integer) TO service_role;

COMMENT ON TABLE public.integration_connections IS 'Vendor connections (PR V0). Secrets in Vault via vault_secret_id; writes via integration-* Edge Functions.';

COMMIT;
