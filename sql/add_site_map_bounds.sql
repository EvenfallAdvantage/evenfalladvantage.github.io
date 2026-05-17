-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  SITE MAP BOUNDS + STORAGE LOCKDOWN — May 14, 2026               ║
-- ║                                                                   ║
-- ║  Fixes two problems with the "rubber sheet" site map feature:    ║
-- ║                                                                   ║
-- ║  1. Site map bounds were being written to a non-existent          ║
-- ║     `events.settings` JSONB column. The error was silently        ║
-- ║     swallowed, so bounds only ever persisted to the aligning      ║
-- ║     admin's localStorage. Other company members never saw the    ║
-- ║     overlay.                                                      ║
-- ║                                                                   ║
-- ║  2. The `operation-maps` storage bucket was wide-open: INSERT/   ║
-- ║     DELETE were granted to any authenticated user from any        ║
-- ║     company, and SELECT was granted to anon. We tighten this so  ║
-- ║     only the owning company's managers can mutate, and only       ║
-- ║     company members can read.                                     ║
-- ║                                                                   ║
-- ║  Run in Supabase SQL Editor (Overwatch DB).                       ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ─── 1. site_map_bounds table ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.site_map_bounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  west DOUBLE PRECISION NOT NULL,
  south DOUBLE PRECISION NOT NULL,
  east DOUBLE PRECISION NOT NULL,
  north DOUBLE PRECISION NOT NULL,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Coordinate sanity: latitude in [-90, 90], longitude in [-180, 180],
  -- and the rectangle must have positive area.
  CHECK (south >= -90 AND south <=  90),
  CHECK (north >= -90 AND north <=  90),
  CHECK (west  >= -180 AND west  <= 180),
  CHECK (east  >= -180 AND east  <= 180),
  CHECK (north > south),
  CHECK (east  > west)
);

CREATE INDEX IF NOT EXISTS idx_site_map_bounds_event   ON public.site_map_bounds(event_id);
CREATE INDEX IF NOT EXISTS idx_site_map_bounds_company ON public.site_map_bounds(company_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.site_map_bounds_touch_updated_at()
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

DROP TRIGGER IF EXISTS trg_site_map_bounds_updated_at ON public.site_map_bounds;
CREATE TRIGGER trg_site_map_bounds_updated_at
  BEFORE UPDATE ON public.site_map_bounds
  FOR EACH ROW
  EXECUTE FUNCTION public.site_map_bounds_touch_updated_at();

ALTER TABLE public.site_map_bounds ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies ──────────────────────────────────────────────────
-- Read: any member of the owning company can view the bounds.
DROP POLICY IF EXISTS site_map_bounds_member_select ON public.site_map_bounds;
CREATE POLICY site_map_bounds_member_select ON public.site_map_bounds
  FOR SELECT TO authenticated
  USING (is_company_member(company_id));

-- Insert: only managers can create bounds (aligning a rubber sheet is a
-- privileged action — it shapes what every member sees).
DROP POLICY IF EXISTS site_map_bounds_manager_insert ON public.site_map_bounds;
CREATE POLICY site_map_bounds_manager_insert ON public.site_map_bounds
  FOR INSERT TO authenticated
  WITH CHECK (is_company_admin(company_id));

-- Update: only managers may re-align.
DROP POLICY IF EXISTS site_map_bounds_manager_update ON public.site_map_bounds;
CREATE POLICY site_map_bounds_manager_update ON public.site_map_bounds
  FOR UPDATE TO authenticated
  USING (is_company_admin(company_id))
  WITH CHECK (is_company_admin(company_id));

-- Delete: only managers.
DROP POLICY IF EXISTS site_map_bounds_manager_delete ON public.site_map_bounds;
CREATE POLICY site_map_bounds_manager_delete ON public.site_map_bounds
  FOR DELETE TO authenticated
  USING (is_company_admin(company_id));

-- ─── 2. Tighten the operation-maps storage bucket ─────────────────
-- Previous state:
--   bucket public=true (kept — needed by getPublicUrl() callers);
--   SELECT to anon+authenticated (any URL holder world-readable);
--   INSERT/DELETE to authenticated (any signed-in user, any company).
--
-- New state:
--   bucket stays public (preserves existing public-URL rendering);
--   SELECT scoped to authenticated company members (drops anon access);
--   INSERT/UPDATE/DELETE scoped to the owning company's managers.
--
-- Path convention (verified from intake-panel.tsx:223 and create-wizard.tsx:130):
--   "<company_id>/<event_id>/<filename>"
-- Policies derive company_id from the leading path segment.
--
-- NOTE: we are intentionally keeping `bucket.public = true` to avoid
-- breaking every existing site_map_url getPublicUrl() call site. The
-- real risk wasn't world-readability of the bytes (URLs are RLS-gated
-- via events.site_map_url) — it was that ANY authenticated user from
-- any tenant could upload/delete to this bucket. That cross-tenant
-- mutation hole is what this section closes.

-- Drop the legacy permissive policies if they exist.
DROP POLICY IF EXISTS "Authenticated users can upload operation maps" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view operation maps"               ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete operation maps" ON storage.objects;

-- Helper: given an object name like "<company_id>/<event_id>/foo.png",
-- parse the leading segment as a UUID. NULL if the path doesn't have one.
-- `SET search_path = ''` is a Postgres security best-practice: pins the
-- schema resolution so a malicious schema can't shadow `split_part`.
CREATE OR REPLACE FUNCTION public.operation_maps_company_for_object(object_name TEXT)
RETURNS UUID
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT NULLIF(split_part(object_name, '/', 1), '')::uuid
$$;

-- Read: any authenticated member of the owning company.
-- (Anon access dropped — outsiders can no longer enumerate the bucket.
--  Existing public URLs continue to resolve because Supabase Storage
--  serves them through the public CDN endpoint when bucket.public=true,
--  which bypasses RLS.)
CREATE POLICY "operation-maps: members can read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'operation-maps'
    AND is_company_member(operation_maps_company_for_object(name))
  );

-- Insert: only managers of the owning company.
CREATE POLICY "operation-maps: managers can upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'operation-maps'
    AND is_company_admin(operation_maps_company_for_object(name))
  );

-- Update (overwrite via upsert): managers only.
CREATE POLICY "operation-maps: managers can update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'operation-maps'
    AND is_company_admin(operation_maps_company_for_object(name))
  );

-- Delete: managers only.
CREATE POLICY "operation-maps: managers can delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'operation-maps'
    AND is_company_admin(operation_maps_company_for_object(name))
  );

-- ─── 3. Verify ─────────────────────────────────────────────────────

SELECT 'site_map_bounds rows' AS object, COUNT(*)::bigint AS count FROM public.site_map_bounds
UNION ALL
SELECT 'site_map_bounds policies', COUNT(*)::bigint FROM pg_policies WHERE tablename = 'site_map_bounds'
UNION ALL
SELECT 'operation-maps storage policies',
       (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE 'operation-maps:%')::bigint;
-- Expected: 0 rows, 4 policies on site_map_bounds, 4 storage policies
