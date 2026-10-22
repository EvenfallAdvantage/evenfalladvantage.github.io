-- Rollback: restore the previous (Supabase default) grants.
GRANT ALL ON TABLE public.site_assessments TO anon, authenticated, service_role;
