-- ═══════════════════════════════════════════════════════════
-- Field Manual: Document Read Tracking + Storage
-- Run this in the Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. Create read-tracking table
CREATE TABLE IF NOT EXISTS kb_document_reads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(document_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_kb_reads_doc ON kb_document_reads(document_id);
CREATE INDEX IF NOT EXISTS idx_kb_reads_user ON kb_document_reads(user_id);

-- 2. Add file metadata columns to kb_documents (if not present)
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- 3. Enable RLS
ALTER TABLE kb_document_reads ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for kb_document_reads
-- Select: any authenticated company member can see reads for docs in their company
CREATE POLICY "kb_reads_select" ON kb_document_reads FOR SELECT TO authenticated
  USING (
    document_id IN (
      SELECT kd.id FROM kb_documents kd
      JOIN kb_folders kf ON kd.folder_id = kf.id
      WHERE is_company_member(kf.company_id)
    )
  );

-- Insert: authenticated users can mark docs as read
CREATE POLICY "kb_reads_insert" ON kb_document_reads FOR INSERT TO authenticated
  WITH CHECK (
    user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text)
  );

-- Delete: users can remove their own reads
CREATE POLICY "kb_reads_delete" ON kb_document_reads FOR DELETE TO authenticated
  USING (
    user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text)
  );

-- 5. Create storage bucket for field manual files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'field-manual',
  'field-manual',
  true,
  52428800, -- 50MB limit
  NULL      -- allow all file types
)
ON CONFLICT (id) DO NOTHING;

-- 6. Storage RLS policies
CREATE POLICY "field_manual_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'field-manual');

CREATE POLICY "field_manual_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'field-manual');

CREATE POLICY "field_manual_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'field-manual');
