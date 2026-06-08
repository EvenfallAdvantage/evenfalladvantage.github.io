-- Incident number generator RPC
-- SECURITY DEFINER to bypass RLS on incident_counters

CREATE OR REPLACE FUNCTION next_incident_number(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_year INTEGER;
  v_seq INTEGER;
  v_result TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM NOW())::INTEGER;

  INSERT INTO incident_counters (company_id, year, seq)
  VALUES (p_company_id, v_year, 1)
  ON CONFLICT (company_id, year) DO UPDATE
    SET seq = incident_counters.seq + 1
    RETURNING seq INTO v_seq;

  v_result := 'INC-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE EXECUTE ON FUNCTION next_incident_number(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION next_incident_number(UUID) TO authenticated;

COMMENT ON FUNCTION next_incident_number(UUID) IS 'Generate next incident number for a company (e.g., INC-2026-0001).';
