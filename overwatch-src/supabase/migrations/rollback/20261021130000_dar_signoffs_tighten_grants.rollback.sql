-- Rollback: restore Supabase default (ALL) grants on dar_signoffs.
GRANT ALL ON TABLE public.dar_signoffs TO anon, authenticated;
