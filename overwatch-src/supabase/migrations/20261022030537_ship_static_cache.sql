-- =============================================================================
-- 20261022030537_ship_static_cache (OverwatchDB nneueuvyeohwnspbwfub ONLY).
-- NOT APPLIED. Needs owner approval.
-- Why: AIS ship type only arrives in ShipStaticData messages (every ~6 min per
-- ship), separate from position reports. ships_static_upsert() only updated
-- ships already in public.ships, and the 30-minute TTL deletes rows, so a
-- type learned once was lost and ~54% of aisstream ships showed no type
-- (rendered as "other"). This keeps static data per MMSI for 30 days and
-- fills it into new ship rows.
--   * public.ship_static: latest static fields per MMSI (service role only).
--   * ships_static_upsert(): now also upserts ship_static (same signature).
--   * ships_fill_static trigger: BEFORE INSERT on ships fills null static
--     fields from ship_static (existing rows already keep their values).
--   * pg_cron 'ship-static-ttl': drop static rows not seen for 30 days.
-- Rollback: rollback/20261022030537_ship_static_cache.rollback.sql
-- =============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.ship_static (
  mmsi        bigint PRIMARY KEY CHECK (mmsi BETWEEN 100000000 AND 999999999),
  name        text CHECK (char_length(name) <= 40),
  callsign    text CHECK (char_length(callsign) <= 12),
  ship_type   smallint,
  length_m    smallint,
  destination text CHECK (char_length(destination) <= 40),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ship_static_updated_at_idx ON public.ship_static (updated_at);
ALTER TABLE public.ship_static ENABLE ROW LEVEL SECURITY;
-- No policies: only the SECURITY DEFINER functions below (and service_role) touch it.
REVOKE ALL ON public.ship_static FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.ship_static FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ship_static TO service_role;

CREATE OR REPLACE FUNCTION public.ships_static_upsert(p_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE n integer;
BEGIN
  IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) > 20000 THEN
    RAISE EXCEPTION 'p_rows must be an array of at most 20000 rows';
  END IF;
  INSERT INTO public.ship_static AS t (mmsi, name, callsign, ship_type, length_m, destination, updated_at)
  SELECT DISTINCT ON (x.mmsi) x.mmsi,
         left(nullif(btrim(x.name), ''), 40), left(nullif(btrim(x.callsign), ''), 12),
         x.ship_type, CASE WHEN x.length_m BETWEEN 1 AND 600 THEN x.length_m END,
         left(nullif(btrim(x.destination), ''), 40), now()
  FROM jsonb_to_recordset(p_rows) AS x(mmsi bigint, name text, callsign text, ship_type smallint, length_m smallint, destination text)
  WHERE x.mmsi BETWEEN 100000000 AND 999999999
  ON CONFLICT (mmsi) DO UPDATE SET
    name = coalesce(EXCLUDED.name, t.name), callsign = coalesce(EXCLUDED.callsign, t.callsign),
    ship_type = coalesce(EXCLUDED.ship_type, t.ship_type), length_m = coalesce(EXCLUDED.length_m, t.length_m),
    destination = coalesce(EXCLUDED.destination, t.destination), updated_at = EXCLUDED.updated_at;

  -- Same update of live rows as before (unchanged behaviour).
  UPDATE public.ships s SET
    name = coalesce(left(nullif(btrim(r.name), ''), 40), s.name),
    callsign = coalesce(left(nullif(btrim(r.callsign), ''), 12), s.callsign),
    ship_type = coalesce(r.ship_type, s.ship_type),
    length_m = coalesce(CASE WHEN r.length_m BETWEEN 1 AND 600 THEN r.length_m END, s.length_m),
    destination = coalesce(left(nullif(btrim(r.destination), ''), 40), s.destination)
  FROM (SELECT DISTINCT ON (mmsi) * FROM jsonb_to_recordset(p_rows) AS x(
          mmsi bigint, name text, callsign text, ship_type smallint, length_m smallint, destination text)) r
  WHERE s.mmsi = r.mmsi;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$fn$;
REVOKE ALL ON FUNCTION public.ships_static_upsert(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ships_static_upsert(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.ships_fill_static()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE st public.ship_static%ROWTYPE;
BEGIN
  IF NEW.ship_type IS NULL OR NEW.name IS NULL OR NEW.length_m IS NULL OR NEW.callsign IS NULL OR NEW.destination IS NULL THEN
    SELECT * INTO st FROM public.ship_static WHERE mmsi = NEW.mmsi;
    IF FOUND THEN
      NEW.ship_type := coalesce(NEW.ship_type, st.ship_type);
      NEW.name := coalesce(NEW.name, st.name);
      NEW.callsign := coalesce(NEW.callsign, st.callsign);
      NEW.length_m := coalesce(NEW.length_m, st.length_m);
      NEW.destination := coalesce(NEW.destination, st.destination);
    END IF;
  END IF;
  RETURN NEW;
END
$fn$;
REVOKE ALL ON FUNCTION public.ships_fill_static() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS ships_fill_static ON public.ships;
CREATE TRIGGER ships_fill_static BEFORE INSERT ON public.ships
  FOR EACH ROW EXECUTE FUNCTION public.ships_fill_static();

-- Seed from what the live table already knows.
INSERT INTO public.ship_static (mmsi, name, callsign, ship_type, length_m, destination, updated_at)
SELECT mmsi, name, callsign, ship_type, length_m, destination, updated_at FROM public.ships
WHERE ship_type IS NOT NULL OR length_m IS NOT NULL
ON CONFLICT (mmsi) DO NOTHING;

SELECT cron.schedule('ship-static-ttl', '17 3 * * *',
  $$DELETE FROM public.ship_static WHERE updated_at < now() - interval '30 days'$$);
COMMIT;
