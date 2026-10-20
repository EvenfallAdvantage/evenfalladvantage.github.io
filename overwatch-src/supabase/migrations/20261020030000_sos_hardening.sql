-- =============================================================================
-- 20261020030000_sos_hardening (OverwatchDB nneueuvyeohwnspbwfub ONLY).
-- NOT APPLIED. Review, then apply by hand. Rollback: rollback/20261020030000_sos_hardening.rollback.sql
--   * public.panic_alert_locations: live-location trail while an SOS is active.
--       insert: only the alert's own sender, only while the alert is active/acknowledged
--       select: members of the alert's company
--       no update/delete for clients (append-only); service_role bypasses RLS
--   * panic_update_own: the sender may mark their own alert false_alarm ("I'm safe").
--   * panic_alerts + panic_alert_locations added to the supabase_realtime publication
--     (realtime still enforces the SELECT policies above).
--   * Trail rows older than 30 days are cleaned by the app's existing data-retention
--     jobs if any; no cron job is added here.
-- =============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.panic_alert_locations (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alert_id    uuid NOT NULL REFERENCES public.panic_alerts(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL,
  user_id     uuid NOT NULL,
  lat         double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng         double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  accuracy    double precision CHECK (accuracy IS NULL OR accuracy >= 0),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS panic_alert_locations_alert_time ON public.panic_alert_locations (alert_id, recorded_at DESC);

ALTER TABLE public.panic_alert_locations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.panic_alert_locations FROM anon;
GRANT SELECT, INSERT ON public.panic_alert_locations TO authenticated;

DROP POLICY IF EXISTS panic_locations_insert_own ON public.panic_alert_locations;
CREATE POLICY panic_locations_insert_own ON public.panic_alert_locations
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT public.get_my_user_id())
    AND EXISTS (
      SELECT 1 FROM public.panic_alerts pa
      WHERE pa.id = alert_id
        AND pa.user_id = (SELECT public.get_my_user_id())
        AND pa.company_id = panic_alert_locations.company_id
        AND pa.status IN ('active', 'acknowledged')
    )
  );

DROP POLICY IF EXISTS panic_locations_select_company ON public.panic_alert_locations;
CREATE POLICY panic_locations_select_company ON public.panic_alert_locations
  FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

-- Sender can close their own alert as a false alarm.
DROP POLICY IF EXISTS panic_update_own ON public.panic_alerts;
CREATE POLICY panic_update_own ON public.panic_alerts
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT public.get_my_user_id()) AND status IN ('active', 'acknowledged'))
  WITH CHECK (user_id = (SELECT public.get_my_user_id()) AND status = 'false_alarm');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'panic_alerts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.panic_alerts;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'panic_alert_locations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.panic_alert_locations;
  END IF;
END $$;

COMMIT;
