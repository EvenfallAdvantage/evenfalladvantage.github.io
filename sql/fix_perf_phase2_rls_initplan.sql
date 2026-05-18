-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  PERFORMANCE WARNINGS — PHASE 2 — RLS auth.uid() INITPLAN         ║
-- ║                                                                   ║
-- ║  PostgreSQL evaluates RLS policy USING/WITH CHECK expressions     ║
-- ║  once per row by default. When the expression contains            ║
-- ║  auth.uid() (or auth.role(), auth.jwt()), the function gets       ║
-- ║  called for EVERY row scanned, even though the result is always   ║
-- ║  identical for a given query.                                     ║
-- ║                                                                   ║
-- ║  Wrapping the call in (SELECT ...) makes the planner treat it as  ║
-- ║  an InitPlan that's evaluated once per query and cached. For      ║
-- ║  large tables this is a substantial speedup.                      ║
-- ║                                                                   ║
-- ║  Reference: https://supabase.com/docs/guides/database/postgres/   ║
-- ║             row-level-security#call-functions-with-select         ║
-- ║                                                                   ║
-- ║  Strategy: a dynamic DO block iterates over every policy in       ║
-- ║  public.* schema, rewrites qual + with_check via regexp_replace   ║
-- ║  (wrapping bare auth.uid/role/jwt calls), and DROP+CREATEs each   ║
-- ║  policy whose expression actually changed. Already-wrapped        ║
-- ║  policies are skipped (no-op detection via DISTINCT FROM).        ║
-- ║                                                                   ║
-- ║  Idempotent — re-running finds nothing to change because the      ║
-- ║  double-wrap-undo step normalizes any (SELECT (SELECT x())) to    ║
-- ║  (SELECT x()) before comparing.                                   ║
-- ║                                                                   ║
-- ║  Safety:                                                          ║
-- ║   - Replacement is mechanical: auth.uid() → (SELECT auth.uid()).  ║
-- ║   - All other policy logic preserved character-for-character.     ║
-- ║   - Policy roles, command type, and permissive flag preserved.    ║
-- ║   - All work runs in one implicit transaction (the DO block);     ║
-- ║     any failure rolls back every change.                          ║
-- ║   - Each rewritten policy is logged via RAISE NOTICE so you can   ║
-- ║     audit what was touched.                                       ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- Set DRY_RUN to true to PREVIEW what would be done without changing anything.
-- Set to false (default) to actually apply the rewrites.
DO $$
DECLARE
  DRY_RUN CONSTANT BOOLEAN := false;  -- ← change to true for preview-only mode
  pol RECORD;
  v_new_qual    TEXT;
  v_new_check   TEXT;
  v_cmd_sql     TEXT;
  v_roles_sql   TEXT;
  v_drop_sql    TEXT;
  v_create_sql  TEXT;
  v_count       INT := 0;
BEGIN
  FOR pol IN
    SELECT
      n.nspname AS schemaname,
      c.relname AS tablename,
      p.polname AS policyname,
      p.polcmd  AS cmd,
      p.polpermissive,
      p.polroles,
      pg_get_expr(p.polqual,      p.polrelid) AS qual,
      pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
    FROM pg_policy p
    JOIN pg_class c     ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
  LOOP
    v_new_qual  := pol.qual;
    v_new_check := pol.with_check;

    -- Wrap bare auth.* calls.
    IF v_new_qual IS NOT NULL THEN
      v_new_qual := regexp_replace(v_new_qual, '\mauth\.uid\(\)',  '(SELECT auth.uid())',  'gi');
      v_new_qual := regexp_replace(v_new_qual, '\mauth\.role\(\)', '(SELECT auth.role())', 'gi');
      v_new_qual := regexp_replace(v_new_qual, '\mauth\.jwt\(\)',  '(SELECT auth.jwt())',  'gi');
      -- Collapse any double-wrapping introduced by the replace above
      -- (i.e. if the policy was already correctly wrapped, the inner
      -- auth.uid() got matched and prefixed again).
      v_new_qual := regexp_replace(
        v_new_qual,
        '\(SELECT\s+\(SELECT\s+(auth\.(?:uid|role|jwt))\(\)\)\)',
        '(SELECT \1())',
        'gi'
      );
    END IF;

    IF v_new_check IS NOT NULL THEN
      v_new_check := regexp_replace(v_new_check, '\mauth\.uid\(\)',  '(SELECT auth.uid())',  'gi');
      v_new_check := regexp_replace(v_new_check, '\mauth\.role\(\)', '(SELECT auth.role())', 'gi');
      v_new_check := regexp_replace(v_new_check, '\mauth\.jwt\(\)',  '(SELECT auth.jwt())',  'gi');
      v_new_check := regexp_replace(
        v_new_check,
        '\(SELECT\s+\(SELECT\s+(auth\.(?:uid|role|jwt))\(\)\)\)',
        '(SELECT \1())',
        'gi'
      );
    END IF;

    -- Skip policies that didn't need rewriting.
    IF v_new_qual  IS NOT DISTINCT FROM pol.qual
       AND v_new_check IS NOT DISTINCT FROM pol.with_check THEN
      CONTINUE;
    END IF;

    -- Map pg_policy.polcmd → SQL command keyword.
    v_cmd_sql := CASE pol.cmd
      WHEN 'r' THEN 'SELECT'
      WHEN 'a' THEN 'INSERT'
      WHEN 'w' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE'
      WHEN '*' THEN 'ALL'
    END;

    -- Resolve role OID array → name list. OID 0 means PUBLIC.
    SELECT string_agg(
      CASE WHEN r = 0 THEN 'PUBLIC' ELSE quote_ident(rolname) END,
      ', '
    )
    INTO v_roles_sql
    FROM unnest(pol.polroles) AS r
    LEFT JOIN pg_authid a ON a.oid = r;

    IF v_roles_sql IS NULL OR v_roles_sql = '' THEN
      v_roles_sql := 'PUBLIC';
    END IF;

    v_drop_sql := format(
      'DROP POLICY %I ON %I.%I',
      pol.policyname, pol.schemaname, pol.tablename
    );

    v_create_sql := format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
      pol.policyname,
      pol.schemaname,
      pol.tablename,
      CASE WHEN pol.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      v_cmd_sql,
      v_roles_sql
    );

    IF v_new_qual IS NOT NULL THEN
      v_create_sql := v_create_sql || ' USING (' || v_new_qual || ')';
    END IF;
    IF v_new_check IS NOT NULL THEN
      v_create_sql := v_create_sql || ' WITH CHECK (' || v_new_check || ')';
    END IF;

    IF DRY_RUN THEN
      RAISE NOTICE 'WOULD rewrite % on %.%', pol.policyname, pol.schemaname, pol.tablename;
      RAISE NOTICE '  DROP:   %', v_drop_sql;
      RAISE NOTICE '  CREATE: %', v_create_sql;
    ELSE
      EXECUTE v_drop_sql;
      EXECUTE v_create_sql;
      RAISE NOTICE 'rewrote % on %.%', pol.policyname, pol.schemaname, pol.tablename;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  IF DRY_RUN THEN
    RAISE NOTICE 'DRY RUN — % policies would have been rewritten (no changes applied)', v_count;
  ELSE
    RAISE NOTICE 'DONE — rewrote % policies', v_count;
  END IF;
END $$;

-- ─── Verification ─────────────────────────────────────────────────
-- After running, this SELECT should return ZERO rows. It catches any
-- policy whose qual or with_check still contains a bare auth.uid(),
-- auth.role(), or auth.jwt() call.
SELECT
  tablename,
  policyname,
  cmd,
  qual       AS using_expr,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    qual       ~* '(?<!\(\s*select\s)\mauth\.(uid|role|jwt)\(\)'
    OR with_check ~* '(?<!\(\s*select\s)\mauth\.(uid|role|jwt)\(\)'
  );
