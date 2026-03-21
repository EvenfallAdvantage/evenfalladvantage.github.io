-- Operation Documents & Acknowledgements
-- Run this on the Overwatch Supabase SQL Editor

-- 1. Operation documents (WARNO, OPORD, FRAGO, GOTWA, intake)
CREATE TABLE IF NOT EXISTS operation_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,          -- 'intake' | 'warno' | 'opord' | 'frago' | 'gotwa'
  version INT DEFAULT 1,
  status TEXT DEFAULT 'draft',     -- 'draft' | 'issued' | 'superseded'
  data JSONB NOT NULL DEFAULT '{}',
  parent_doc_id UUID REFERENCES operation_documents(id),
  created_by UUID REFERENCES users(id),
  issued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_op_docs_event ON operation_documents(event_id);
CREATE INDEX IF NOT EXISTS idx_op_docs_type ON operation_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_op_docs_company ON operation_documents(company_id);

-- 2. Document acknowledgements (track who received / acknowledged a doc)
CREATE TABLE IF NOT EXISTS document_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES operation_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(document_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_doc_acks_document ON document_acknowledgements(document_id);

-- 3. Extend events table with TLP + intake metadata columns
ALTER TABLE events ADD COLUMN IF NOT EXISTS tlp_step TEXT DEFAULT 'receive_mission';
ALTER TABLE events ADD COLUMN IF NOT EXISTS risk_level TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS engagement_type TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_type TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS estimated_attendance TEXT;

-- 4. RLS policies
ALTER TABLE operation_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_acknowledgements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view docs for their company" ON operation_documents
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM company_memberships WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert docs for their company" ON operation_documents
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM company_memberships WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update docs for their company" ON operation_documents
  FOR UPDATE USING (
    company_id IN (SELECT company_id FROM company_memberships WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete docs for their company" ON operation_documents
  FOR DELETE USING (
    company_id IN (SELECT company_id FROM company_memberships WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view acks for docs in their company" ON document_acknowledgements
  FOR SELECT USING (
    document_id IN (
      SELECT id FROM operation_documents WHERE company_id IN (
        SELECT company_id FROM company_memberships WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert their own ack" ON document_acknowledgements
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own ack" ON document_acknowledgements
  FOR DELETE USING (user_id = auth.uid());
