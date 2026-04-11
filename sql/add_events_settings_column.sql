-- Add settings JSONB column to events table for site map bounds and other per-event config
-- This column stores arbitrary JSON like { site_map_bounds: { north, south, east, west, rotation } }
-- Safe to run multiple times (IF NOT EXISTS)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'settings'
  ) THEN
    ALTER TABLE events ADD COLUMN settings jsonb DEFAULT '{}';
  END IF;
END $$;
