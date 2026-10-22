-- site_assessments: align grants with the table-grant rule.
-- anon: no access (only signed-in company managers use this table; the read
-- policy already requires auth.uid()). authenticated/service_role: CRUD only.
REVOKE ALL ON TABLE public.site_assessments FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.site_assessments FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.site_assessments TO authenticated, service_role;
ALTER TABLE public.site_assessments ENABLE ROW LEVEL SECURITY;
