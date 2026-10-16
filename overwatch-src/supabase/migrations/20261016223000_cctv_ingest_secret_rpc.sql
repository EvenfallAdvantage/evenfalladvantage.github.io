-- intel-cctv-ingest verifies its x-ingest-secret header against the Vault
-- secret 'cctv_ingest_secret' (the same one pg_cron sends). The secret never
-- leaves the database: this returns only a boolean. Both sides are SHA-256
-- hashed before comparing, so comparison time doesn't depend on how many
-- leading characters match. Callable by service_role only.
CREATE OR REPLACE FUNCTION public.cctv_ingest_secret_matches(candidate text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(
    length(btrim(coalesce(candidate, ''))) >= 32
    AND extensions.digest(btrim(candidate), 'sha256')
      = extensions.digest(btrim(s.decrypted_secret, E' \n\r\t'), 'sha256'),
    false)
  FROM (SELECT (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cctv_ingest_secret' LIMIT 1) AS decrypted_secret) s;
$$;

REVOKE ALL ON FUNCTION public.cctv_ingest_secret_matches(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cctv_ingest_secret_matches(text) TO service_role;
