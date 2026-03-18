-- ============================================================
-- OVERWATCH — Recent Schema Additions
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Roster privacy column
ALTER TABLE company_memberships
  ADD COLUMN IF NOT EXISTS hide_contact_roster boolean DEFAULT false;

-- 2. KB document required + file metadata columns
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS required boolean DEFAULT false;
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- 3. Missing UPDATE policy for kb_documents (was missing — blocks required toggle)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'kb_documents' AND policyname = 'kb_documents_update'
  ) THEN
    EXECUTE 'CREATE POLICY "kb_documents_update" ON kb_documents FOR UPDATE TO authenticated
      USING (folder_id IN (SELECT id FROM kb_folders WHERE is_company_admin(company_id)))';
  END IF;
END $$;

-- 4. Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
