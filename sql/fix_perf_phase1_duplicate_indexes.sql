-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  PERFORMANCE WARNINGS — PHASE 1 — DUPLICATE INDEX CLEANUP         ║
-- ║                                                                   ║
-- ║  Two pairs of identical indexes flagged by the Supabase linter:   ║
-- ║                                                                   ║
-- ║    time_off_policies(company_id):                                 ║
-- ║      - idx_time_off_policies_company   (from supabase-setup.sql)  ║
-- ║      - time_off_policies_company_id_idx (from supabase-init.sql)  ║
-- ║                                                                   ║
-- ║    time_off_requests(user_id):                                    ║
-- ║      - idx_time_off_user                (from supabase-setup.sql) ║
-- ║      - time_off_requests_user_id_idx    (from supabase-init.sql)  ║
-- ║                                                                   ║
-- ║  Strategy: drop the Prisma-generated `*_idx` ones, keep the       ║
-- ║  manually-named `idx_*` ones (more discoverable in code search).  ║
-- ║                                                                   ║
-- ║  Safe: dropping a duplicate index is a no-op for query planning   ║
-- ║  because the remaining index serves identical queries. The only   ║
-- ║  effect is faster INSERT/UPDATE/DELETE (one fewer index to        ║
-- ║  maintain on each row change).                                    ║
-- ║                                                                   ║
-- ║  Idempotent — DROP INDEX IF EXISTS.                               ║
-- ╚══════════════════════════════════════════════════════════════════╝

DROP INDEX IF EXISTS public.time_off_policies_company_id_idx;
DROP INDEX IF EXISTS public.time_off_requests_user_id_idx;

-- Verification: each table should now have exactly ONE index on the
-- relevant column. The remaining ones should be idx_time_off_policies_company
-- and idx_time_off_user.
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('time_off_policies', 'time_off_requests')
  AND (indexdef LIKE '%(company_id)%' OR indexdef LIKE '%(user_id)%')
ORDER BY tablename, indexname;
