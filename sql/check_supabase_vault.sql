-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  CHECK: Is supabase_vault available?                              ║
-- ║                                                                   ║
-- ║  Run in the Supabase SQL editor against the Overwatch DB.         ║
-- ║  Used by the Roster Invitation / Mass Email feature to store      ║
-- ║  per-company SMTP credentials and email-provider API keys         ║
-- ║  encrypted at rest.                                               ║
-- ║                                                                   ║
-- ║  Expected: extension is INSTALLED. If not, enable via             ║
-- ║    Dashboard → Database → Extensions → "vault" → Enable           ║
-- ║  before running any of the email-feature migrations.              ║
-- ╚══════════════════════════════════════════════════════════════════╝

SELECT
  extname,
  extversion,
  extnamespace::regnamespace AS schema
FROM pg_extension
WHERE extname IN ('supabase_vault', 'pgsodium');

-- Expected: at minimum 'supabase_vault' row with extversion (e.g. 0.2.8+)
-- and schema = 'vault'. If empty, extension is not enabled.

-- Also verify the decrypted-secrets view is callable. Returns no rows if
-- there are no secrets yet, but should NOT error.
SELECT count(*) AS secret_count
FROM vault.decrypted_secrets;
