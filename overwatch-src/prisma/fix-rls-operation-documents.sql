-- Fix RLS 403 on operation_documents INSERT/UPDATE/DELETE
-- Approach: route permission check through the events table (which has working RLS)
-- If the user can see the event, they can CRUD docs for that event.

-- 1. Drop ALL existing policies on operation_documents
DROP POLICY IF EXISTS "Users can view docs for their company" ON operation_documents;
DROP POLICY IF EXISTS "Users can insert docs for their company" ON operation_documents;
DROP POLICY IF EXISTS "Users can update docs for their company" ON operation_documents;
DROP POLICY IF EXISTS "Users can delete docs for their company" ON operation_documents;
DROP POLICY IF EXISTS "docs_select" ON operation_documents;
DROP POLICY IF EXISTS "docs_insert" ON operation_documents;
DROP POLICY IF EXISTS "docs_update" ON operation_documents;
DROP POLICY IF EXISTS "docs_delete" ON operation_documents;

-- 2. Create new policies that check via events table (events RLS already works)
CREATE POLICY "docs_select" ON operation_documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = operation_documents.event_id)
  );

CREATE POLICY "docs_insert" ON operation_documents
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_id)
  );

CREATE POLICY "docs_update" ON operation_documents
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = operation_documents.event_id)
  );

CREATE POLICY "docs_delete" ON operation_documents
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = operation_documents.event_id)
  );

-- 3. Drop and recreate ack policies (route through operation_documents which now works)
DROP POLICY IF EXISTS "Users can view acks for docs in their company" ON document_acknowledgements;
DROP POLICY IF EXISTS "Users can insert their own ack" ON document_acknowledgements;
DROP POLICY IF EXISTS "Users can delete their own ack" ON document_acknowledgements;
DROP POLICY IF EXISTS "acks_select" ON document_acknowledgements;
DROP POLICY IF EXISTS "acks_insert" ON document_acknowledgements;
DROP POLICY IF EXISTS "acks_delete" ON document_acknowledgements;

CREATE POLICY "acks_select" ON document_acknowledgements
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM operation_documents WHERE operation_documents.id = document_acknowledgements.document_id)
  );

CREATE POLICY "acks_insert" ON document_acknowledgements
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "acks_delete" ON document_acknowledgements
  FOR DELETE USING (user_id = auth.uid());
