-- Fix RLS 403 on operation_documents INSERT/UPDATE/DELETE
-- The subquery against company_memberships is blocked by its own RLS.
-- Solution: use a security-definer function that bypasses RLS.

-- 1. Create a helper function (runs as DB owner, bypasses RLS)
CREATE OR REPLACE FUNCTION user_belongs_to_company(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_memberships
    WHERE user_id = auth.uid()
      AND company_id = p_company_id
  );
$$;

-- 2. Drop old policies on operation_documents
DROP POLICY IF EXISTS "Users can view docs for their company" ON operation_documents;
DROP POLICY IF EXISTS "Users can insert docs for their company" ON operation_documents;
DROP POLICY IF EXISTS "Users can update docs for their company" ON operation_documents;
DROP POLICY IF EXISTS "Users can delete docs for their company" ON operation_documents;

-- 3. Recreate policies using the security-definer function
CREATE POLICY "Users can view docs for their company" ON operation_documents
  FOR SELECT USING (user_belongs_to_company(company_id));

CREATE POLICY "Users can insert docs for their company" ON operation_documents
  FOR INSERT WITH CHECK (user_belongs_to_company(company_id));

CREATE POLICY "Users can update docs for their company" ON operation_documents
  FOR UPDATE USING (user_belongs_to_company(company_id));

CREATE POLICY "Users can delete docs for their company" ON operation_documents
  FOR DELETE USING (user_belongs_to_company(company_id));

-- 4. Drop old policies on document_acknowledgements
DROP POLICY IF EXISTS "Users can view acks for docs in their company" ON document_acknowledgements;
DROP POLICY IF EXISTS "Users can insert their own ack" ON document_acknowledgements;
DROP POLICY IF EXISTS "Users can delete their own ack" ON document_acknowledgements;

-- 5. Recreate ack policies using the function
CREATE POLICY "Users can view acks for docs in their company" ON document_acknowledgements
  FOR SELECT USING (
    document_id IN (
      SELECT id FROM operation_documents WHERE user_belongs_to_company(company_id)
    )
  );

CREATE POLICY "Users can insert their own ack" ON document_acknowledgements
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own ack" ON document_acknowledgements
  FOR DELETE USING (user_id = auth.uid());
