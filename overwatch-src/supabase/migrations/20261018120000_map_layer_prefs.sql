-- =============================================================================
-- 20261018120000_map_layer_prefs.sql   (Ops map layer consolidation, PR C)
-- Target: OverwatchDB (project nneueuvyeohwnspbwfub) ONLY.
-- Status: NOT APPLIED (draft). Safe to apply before or after the web deploy:
--         the app falls back to browser storage while these tables are absent.
-- Rollback: rollback/20261018120000_map_layer_prefs.rollback.sql
--
-- New tables (RLS on):
--   user_map_prefs        one row per (user, company, device class); the
--                         user's own map layers / preset / view settings so
--                         they follow the user across devices. Owner-only.
--   company_map_defaults  one row per company: default presets, whether the
--                         new layers panel is on for the company, groups
--                         hidden company-wide, "near my sites" distances.
--                         Members read; company admins (owner/admin/manager,
--                         is_company_admin) write.
-- No anon access. No functions or triggers beyond updated_at bookkeeping.
-- =============================================================================

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.companies') IS NULL
     OR to_regclass('public.company_memberships') IS NULL
     OR to_regprocedure('public.is_company_admin(uuid)') IS NULL
     OR to_regprocedure('public.is_company_member(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Wrong database: this migration is for OverwatchDB (nneueuvyeohwnspbwfub)';
  END IF;
END
$guard$;

-- ── user_map_prefs ──────────────────────────────────────────────────────────
CREATE TABLE public.user_map_prefs (
  user_id      uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id   uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  device_class text        NOT NULL DEFAULT 'desktop' CHECK (device_class IN ('desktop', 'mobile')),
  preset       text        NOT NULL DEFAULT 'custom'
                           CHECK (preset IN ('clean', 'securityOps', 'weatherWatch', 'airWatch', 'custom')),
  layers       jsonb       NOT NULL DEFAULT '{}'::jsonb
                           CHECK (jsonb_typeof(layers) = 'object' AND pg_column_size(layers) <= 16384),
  view         jsonb       NOT NULL DEFAULT '{}'::jsonb
                           CHECK (jsonb_typeof(view) = 'object' AND pg_column_size(view) <= 4096),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, company_id, device_class)
);
COMMENT ON TABLE public.user_map_prefs IS
  'Ops map layer preferences per user, company and device class (desktop/mobile). Owner-only. layers = map layer switches; view = {panelV2, scope, siteWatch}.';

-- ── company_map_defaults ────────────────────────────────────────────────────
CREATE TABLE public.company_map_defaults (
  company_id            uuid        PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  default_preset        text        NOT NULL DEFAULT 'securityOps'
                                    CHECK (default_preset IN ('clean', 'securityOps', 'weatherWatch', 'airWatch')),
  default_preset_mobile text        NOT NULL DEFAULT 'clean'
                                    CHECK (default_preset_mobile IN ('clean', 'securityOps', 'weatherWatch', 'airWatch')),
  panel_v2              boolean     NOT NULL DEFAULT true,
  hidden_groups         text[]      NOT NULL DEFAULT '{}'
                                    CHECK (hidden_groups <@ ARRAY['weather', 'security', 'airSea', 'cameras', 'infrastructure']::text[]),
  near_radii_km         jsonb       NOT NULL DEFAULT '{}'::jsonb
                                    CHECK (jsonb_typeof(near_radii_km) = 'object' AND pg_column_size(near_radii_km) <= 2048),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            uuid        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);
COMMENT ON TABLE public.company_map_defaults IS
  'Company-wide Ops map defaults: presets for new users (desktop/mobile), new layers panel on/off, groups hidden for the company, near-my-sites distances (km). Admin write.';

-- ── updated_at / updated_by bookkeeping ─────────────────────────────────────
CREATE FUNCTION public.map_prefs_touch() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $fn$
BEGIN
  NEW.updated_at := now();
  IF TG_TABLE_NAME = 'company_map_defaults' THEN
    NEW.updated_by := auth.uid();
  END IF;
  RETURN NEW;
END
$fn$;
REVOKE ALL ON FUNCTION public.map_prefs_touch() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER user_map_prefs_touch BEFORE INSERT OR UPDATE ON public.user_map_prefs
  FOR EACH ROW EXECUTE FUNCTION public.map_prefs_touch();
CREATE TRIGGER company_map_defaults_touch BEFORE INSERT OR UPDATE ON public.company_map_defaults
  FOR EACH ROW EXECUTE FUNCTION public.map_prefs_touch();

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_map_prefs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_map_defaults ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_map_prefs, public.company_map_defaults FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.user_map_prefs, public.company_map_defaults TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_map_prefs TO authenticated;
CREATE POLICY user_map_prefs_select ON public.user_map_prefs
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY user_map_prefs_insert ON public.user_map_prefs
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()) AND public.is_company_member(company_id));
CREATE POLICY user_map_prefs_update ON public.user_map_prefs
  FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()) AND public.is_company_member(company_id));
CREATE POLICY user_map_prefs_delete ON public.user_map_prefs
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.company_map_defaults TO authenticated;
CREATE POLICY company_map_defaults_select ON public.company_map_defaults
  FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY company_map_defaults_insert ON public.company_map_defaults
  FOR INSERT TO authenticated WITH CHECK (public.is_company_admin(company_id));
CREATE POLICY company_map_defaults_update ON public.company_map_defaults
  FOR UPDATE TO authenticated USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

COMMIT;
