-- Rollback for 20261018120000_map_layer_prefs.sql (OverwatchDB only).
-- Drops the map preference tables. The app falls back to browser storage.
BEGIN;
DROP TABLE IF EXISTS public.user_map_prefs;
DROP TABLE IF EXISTS public.company_map_defaults;
DROP FUNCTION IF EXISTS public.map_prefs_touch();
COMMIT;
