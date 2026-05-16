-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  SITE MAP QUAD CORNERS — May 16, 2026                             ║
-- ║                                                                   ║
-- ║  Extends `site_map_bounds` from an axis-aligned rectangle         ║
-- ║  (north-up only) to a full quadrilateral, so site maps that are   ║
-- ║  rotated/skewed relative to north can be draped correctly.        ║
-- ║                                                                   ║
-- ║  The four corners map IMAGE pixel coordinates (normalized 0..1)   ║
-- ║  to lat/lng. Naming uses image-space, not compass-space, since    ║
-- ║  the image may be rotated:                                        ║
-- ║                                                                   ║
-- ║    c00 = image (0, 0)  top-left                                    ║
-- ║    c10 = image (1, 0)  top-right                                   ║
-- ║    c11 = image (1, 1)  bottom-right                                ║
-- ║    c01 = image (0, 1)  bottom-left                                 ║
-- ║                                                                   ║
-- ║  The legacy west/south/east/north columns are kept and remain     ║
-- ║  NOT NULL — they store the axis-aligned bounding box of the quad  ║
-- ║  so older clients (and the heatmap legacy path) keep working.     ║
-- ║                                                                   ║
-- ║  Run in Supabase SQL Editor (Overwatch DB).                       ║
-- ╚══════════════════════════════════════════════════════════════════╝

ALTER TABLE public.site_map_bounds
  ADD COLUMN IF NOT EXISTS c00_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS c00_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS c10_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS c10_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS c11_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS c11_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS c01_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS c01_lng DOUBLE PRECISION;

-- Sanity: if any corner is set, all 8 must be set. Allow all-NULL
-- (legacy axis-aligned rows) OR all-set (new quad rows).
ALTER TABLE public.site_map_bounds
  DROP CONSTRAINT IF EXISTS site_map_bounds_quad_all_or_none;

ALTER TABLE public.site_map_bounds
  ADD CONSTRAINT site_map_bounds_quad_all_or_none
  CHECK (
    (c00_lat IS NULL AND c00_lng IS NULL
       AND c10_lat IS NULL AND c10_lng IS NULL
       AND c11_lat IS NULL AND c11_lng IS NULL
       AND c01_lat IS NULL AND c01_lng IS NULL)
    OR
    (c00_lat IS NOT NULL AND c00_lng IS NOT NULL
       AND c10_lat IS NOT NULL AND c10_lng IS NOT NULL
       AND c11_lat IS NOT NULL AND c11_lng IS NOT NULL
       AND c01_lat IS NOT NULL AND c01_lng IS NOT NULL)
  );

-- ─── Verify ─────────────────────────────────────────────────────
SELECT
  COUNT(*)::bigint                                              AS total_rows,
  COUNT(*) FILTER (WHERE c00_lat IS NOT NULL)::bigint           AS quad_rows,
  COUNT(*) FILTER (WHERE c00_lat IS NULL)::bigint               AS legacy_axis_aligned_rows
FROM public.site_map_bounds;
-- Expected on first run: total = existing, quad = 0, legacy = existing.
