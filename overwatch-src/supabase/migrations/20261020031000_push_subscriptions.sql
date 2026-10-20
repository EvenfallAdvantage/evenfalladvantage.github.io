-- =============================================================================
-- 20261020031000_push_subscriptions (OverwatchDB nneueuvyeohwnspbwfub ONLY).
-- NOT APPLIED. Rollback: rollback/20261020031000_push_subscriptions.rollback.sql
-- Web push device registrations (one row per browser/device endpoint).
--   * Users can see, add, refresh and remove only their own rows.
--   * push-send (service role) reads them to deliver and deletes expired ones.
--   * company_id is informational (a device receives alerts for every company
--     the user belongs to); RLS does not depend on it.
-- =============================================================================
BEGIN;
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id   uuid,
  endpoint     text NOT NULL UNIQUE CHECK (endpoint ~ '^https://' AND length(endpoint) <= 1000),
  p256dh       text NOT NULL CHECK (length(p256dh) BETWEEN 20 AND 200),
  auth         text NOT NULL CHECK (length(auth) BETWEEN 8 AND 100),
  user_agent   text CHECK (user_agent IS NULL OR length(user_agent) <= 300),
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user ON public.push_subscriptions (user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_subscriptions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;

DROP POLICY IF EXISTS push_subs_own_select ON public.push_subscriptions;
CREATE POLICY push_subs_own_select ON public.push_subscriptions FOR SELECT TO authenticated USING (user_id = (SELECT public.get_my_user_id()));
DROP POLICY IF EXISTS push_subs_own_insert ON public.push_subscriptions;
CREATE POLICY push_subs_own_insert ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT public.get_my_user_id()));
DROP POLICY IF EXISTS push_subs_own_update ON public.push_subscriptions;
CREATE POLICY push_subs_own_update ON public.push_subscriptions FOR UPDATE TO authenticated USING (user_id = (SELECT public.get_my_user_id())) WITH CHECK (user_id = (SELECT public.get_my_user_id()));
DROP POLICY IF EXISTS push_subs_own_delete ON public.push_subscriptions;
CREATE POLICY push_subs_own_delete ON public.push_subscriptions FOR DELETE TO authenticated USING (user_id = (SELECT public.get_my_user_id()));
COMMIT;
