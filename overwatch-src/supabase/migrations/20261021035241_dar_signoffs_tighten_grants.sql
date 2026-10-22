-- Tighten dar_signoffs grants (house rule): SELECT to anon;
-- SELECT/INSERT/UPDATE/DELETE to authenticated and service_role.
-- Schema default privileges had granted ALL to anon/authenticated.
-- RLS policies (authenticated only) are unchanged.
REVOKE ALL ON TABLE public.dar_signoffs FROM anon;
GRANT SELECT ON TABLE public.dar_signoffs TO anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.dar_signoffs FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dar_signoffs TO authenticated, service_role;
