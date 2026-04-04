-- Storyboard System
-- Site maps on operations + pin-based annotation for incidents and field reports

-- 1. Add site map columns to events table
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS site_map_url TEXT,
  ADD COLUMN IF NOT EXISTS site_map_thumbnail_url TEXT;

-- 2. Create storyboards table
CREATE TABLE IF NOT EXISTS storyboards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'Storyboard',
  pins        JSONB DEFAULT '[]',
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- pins JSONB structure:
-- [{
--   id: uuid,
--   x: number (0-1, percentage),
--   y: number (0-1, percentage),
--   label: string,
--   description: string,
--   icon: "pin"|"gate"|"camera"|"incident"|"medical"|"personnel"|"fire"|"exit"|"radio"|"car"|"star",
--   color: string (hex),
--   timestamp: ISO string,
--   createdBy: uuid
-- }]

CREATE INDEX IF NOT EXISTS idx_storyboards_event ON storyboards(event_id);
CREATE INDEX IF NOT EXISTS idx_storyboards_company ON storyboards(company_id);

-- 3. Add storyboard reference to incidents table
ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS storyboard_id UUID REFERENCES storyboards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS storyboard_pin_id TEXT;

-- 4. RLS policies for storyboards
ALTER TABLE storyboards ENABLE ROW LEVEL SECURITY;

-- Uses is_company_member() helper which correctly joins through
-- users.supabase_id = auth.uid()::text (NOT user_id = auth.uid() directly)
CREATE POLICY "Company members can view storyboards"
  ON storyboards FOR SELECT TO authenticated
  USING (is_company_member(company_id));

CREATE POLICY "Company members can create storyboards"
  ON storyboards FOR INSERT TO authenticated
  WITH CHECK (is_company_member(company_id));

CREATE POLICY "Company members can update storyboards"
  ON storyboards FOR UPDATE TO authenticated
  USING (is_company_member(company_id));

CREATE POLICY "Company members can delete storyboards"
  ON storyboards FOR DELETE TO authenticated
  USING (is_company_member(company_id));

-- 5. Create operation-maps storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'operation-maps',
  'operation-maps',
  true,
  20971520,  -- 20 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload operation maps"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'operation-maps');

CREATE POLICY "Anyone can view operation maps"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'operation-maps');

CREATE POLICY "Authenticated users can delete operation maps"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'operation-maps');

-- 6. Auto-update updated_at trigger for storyboards
CREATE OR REPLACE FUNCTION update_storyboard_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_storyboard_updated_at
  BEFORE UPDATE ON storyboards
  FOR EACH ROW
  EXECUTE FUNCTION update_storyboard_updated_at();
