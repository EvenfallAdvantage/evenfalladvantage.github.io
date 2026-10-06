-- =============================================================================
-- RLS hardening test plan (role impersonation).
-- Each check switches to the `authenticated` (or `anon`) role and sets
-- request.jwt.claims = {"sub": <auth uid>, "email": ..., "role": ...}, which is
-- what PostgREST does for a browser request. Expectations:
--   'error'   -> the statement must raise (attack path closed)
--   'ok'      -> the statement must succeed (legit flow still works)
--   '<value>' -> first column of the first row must equal this text
--
-- LOCAL ONLY: run on a throwaway Postgres after local_stub_schema.sql,
-- rls_hardening_seed.sql and the migration (see tests/README.md). It creates a
-- helper schema `rls_test`. Do not run it against a Supabase project.
--
-- People (company A = Acme, B = Beta): a1 owner A, a2 admin A, a3 manager A,
-- a4 instructor A, a5 lead A, a6 officer (staff) A, a7 officer2 (staff) A,
-- a8 manager2 A, a9 owner2 A, b1 owner B, b2 staff B, c1 newbie (no company),
-- c2 fresh (auth user, no users row), c3 prober (no company).
-- =============================================================================
\set ON_ERROR_STOP 1
RESET ROLE;
DROP SCHEMA IF EXISTS rls_test CASCADE;
CREATE SCHEMA rls_test;
GRANT USAGE ON SCHEMA rls_test TO anon, authenticated;
CREATE TABLE rls_test.results (n serial PRIMARY KEY, label text, ok boolean, detail text);
CREATE TABLE rls_test.vars (k text PRIMARY KEY, v text);
GRANT ALL ON rls_test.results, rls_test.vars TO anon, authenticated;
GRANT USAGE ON SEQUENCE rls_test.results_n_seq TO anon, authenticated;

CREATE FUNCTION rls_test.login(p text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_uid text := '00000000-0000-0000-0000-0000000000' || p; v_email text;
BEGIN
  RESET ROLE;
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid::uuid;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_uid, 'email', v_email, 'role', 'authenticated')::text, false);
  SET ROLE authenticated;
END $$;
CREATE FUNCTION rls_test.anon() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', false);
  SET ROLE anon;
END $$;
CREATE FUNCTION rls_test.superuser() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', false);
END $$;
CREATE FUNCTION rls_test.t(p_label text, p_expect text, p_sql text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v text; v_ok boolean; v_detail text;
BEGIN
  BEGIN
    IF p_sql ~* '^\s*(insert|update|delete)\M' AND p_sql !~* '\mreturning\M' THEN
      EXECUTE p_sql;           -- plain DML: no result column
      v := 'done';
    ELSE
      EXECUTE p_sql INTO v;
    END IF;
    IF p_expect = 'error' THEN v_ok := false; v_detail := 'expected an error, got: ' || COALESCE(v, 'NULL');
    ELSIF p_expect = 'ok' THEN v_ok := true; v_detail := COALESCE(v, 'NULL');
    ELSE v_ok := COALESCE(v, 'NULL') = p_expect; v_detail := 'got: ' || COALESCE(v, 'NULL');
    END IF;
  EXCEPTION WHEN others THEN
    v_ok := p_expect = 'error'; v_detail := SQLERRM;
  END;
  INSERT INTO rls_test.results (label, ok, detail) VALUES (p_label, v_ok, left(v_detail, 160));
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA rls_test TO anon, authenticated;

-- ============================ 1. Memberships ===============================
SELECT rls_test.login('a6');
SELECT rls_test.t('1.01 staff self-inserts an owner membership into another company (B)', 'error',
  $q$INSERT INTO company_memberships (id, user_id, company_id, role, updated_at)
     VALUES (gen_random_uuid(), get_my_user_id(), '20000000-0000-0000-0000-00000000000b', 'owner', now())$q$);
SELECT rls_test.t('1.02 staff promotes own membership to owner', 'error',
  $q$UPDATE company_memberships SET role = 'owner' WHERE id = '30000000-0000-0000-0000-0000000000a6'$q$);
SELECT rls_test.t('1.03 staff moves own membership to company B', 'error',
  $q$UPDATE company_memberships SET company_id = '20000000-0000-0000-0000-00000000000b' WHERE id = '30000000-0000-0000-0000-0000000000a6'$q$);
SELECT rls_test.t('1.04 staff sets own pay_rate_override', 'error',
  $q$UPDATE company_memberships SET pay_rate_override = 99 WHERE id = '30000000-0000-0000-0000-0000000000a6'$q$);
SELECT rls_test.t('1.05 staff edits own profile field (bio) [legit]', '1',
  $q$WITH u AS (UPDATE company_memberships SET bio = 'hello', radio_states = '{ch1}' WHERE id = '30000000-0000-0000-0000-0000000000a6' RETURNING 1) SELECT count(*) FROM u$q$);
SELECT rls_test.t('1.06 staff edits someone else''s membership (silently 0 rows)', '0',
  $q$WITH u AS (UPDATE company_memberships SET bio = 'x' WHERE id = '30000000-0000-0000-0000-0000000000a7' RETURNING 1) SELECT count(*) FROM u$q$);

SELECT rls_test.login('c1');
SELECT rls_test.t('1.07 newbie self-inserts a staff membership into A (no join code)', 'error',
  $q$INSERT INTO company_memberships (id, user_id, company_id, role, updated_at)
     VALUES (gen_random_uuid(), get_my_user_id(), '20000000-0000-0000-0000-00000000000a', 'staff', now())$q$);
SELECT rls_test.t('1.08 create_company_with_owner makes the creator owner [legit]', 'owner',
  $q$SELECT (create_company_with_owner('Newbie Co', NULL, NULL, NULL, 'New', 'Bie') -> 'membership' ->> 'role')$q$);
SELECT rls_test.t('1.09 new company gets a 10-char join code [legit]', '10',
  $q$SELECT length(create_company_with_owner('Newbie Two', '00000000-0000-0000-0000-0000000000c1') -> 'company' ->> 'join_code')::text$q$);
SELECT rls_test.t('1.10 create_company_with_owner with someone else''s p_supabase_id', 'error',
  $q$SELECT create_company_with_owner('Spoof Co', '00000000-0000-0000-0000-0000000000a1')$q$);
SELECT rls_test.t('1.11 join_company_by_code with an existing 6-char code gives staff [legit]', 'staff',
  $q$SELECT (join_company_by_code('abc234', NULL) -> 'membership' ->> 'role')$q$);
SELECT rls_test.t('1.12 join_company_by_code with someone else''s p_supabase_id', 'error',
  $q$SELECT join_company_by_code('XYZ789', '00000000-0000-0000-0000-0000000000b2')$q$);

SELECT rls_test.login('c2');
SELECT rls_test.t('1.13 brand-new user (no users row) creates a company and is owner [legit]', 'owner',
  $q$SELECT (create_company_with_owner('Fresh Co', '00000000-0000-0000-0000-0000000000c2', 'spoof@evil.test', NULL, 'Fresh', 'User') -> 'membership' ->> 'role')$q$);
SELECT rls_test.t('1.14 users.email comes from auth, not p_email', 'fresh@test.local',
  $q$SELECT email FROM users WHERE supabase_id = auth.uid()::text$q$);

SELECT rls_test.login('a2');
SELECT rls_test.t('1.15 admin re-joins own company by code: role unchanged (admin)', 'admin',
  $q$SELECT (join_company_by_code('ABC234') -> 'membership' ->> 'role')$q$);

-- Role hierarchy: owner 60 > admin 50 > instructor 45 > manager 40 > lead 30 > breaker 20 > staff 10 > client 5
SELECT rls_test.login('a3');  -- manager A
SELECT rls_test.t('1.16 manager promotes staff to lead (one below manager) [legit]', 'ok',
  $q$SELECT update_member_role('30000000-0000-0000-0000-0000000000a6', 'lead')$q$);
SELECT rls_test.t('1.17 manager promotes staff to manager (equal to own)', 'error',
  $q$SELECT update_member_role('30000000-0000-0000-0000-0000000000a7', 'manager')$q$);
SELECT rls_test.t('1.18 manager promotes staff to admin (above own)', 'error',
  $q$SELECT update_member_role('30000000-0000-0000-0000-0000000000a7', 'admin')$q$);
SELECT rls_test.t('1.19 manager promotes staff to instructor (above own)', 'error',
  $q$SELECT update_member_role('30000000-0000-0000-0000-0000000000a7', 'instructor')$q$);
SELECT rls_test.t('1.20 manager demotes a peer manager', 'error',
  $q$SELECT update_member_role('30000000-0000-0000-0000-0000000000a8', 'staff')$q$);
SELECT rls_test.t('1.21 manager demotes a superior (instructor)', 'error',
  $q$SELECT update_member_role('30000000-0000-0000-0000-0000000000a4', 'staff')$q$);
SELECT rls_test.t('1.22 manager demotes a superior (admin)', 'error',
  $q$SELECT update_member_role('30000000-0000-0000-0000-0000000000a2', 'staff')$q$);
SELECT rls_test.t('1.23 manager changes own role', 'error',
  $q$SELECT update_member_role('30000000-0000-0000-0000-0000000000a3', 'lead')$q$);
SELECT rls_test.t('1.24 manager changes a member of another company', 'error',
  $q$SELECT update_member_role('30000000-0000-0000-0000-0000000000b2', 'lead')$q$);
SELECT rls_test.t('1.25 manager demotes lead to breaker [legit]', 'ok',
  $q$SELECT update_member_role('30000000-0000-0000-0000-0000000000a5', 'breaker')$q$);

SELECT rls_test.login('a2');  -- admin A
SELECT rls_test.t('1.26 admin promotes staff to instructor (one below admin) [legit]', 'ok',
  $q$SELECT update_member_role('30000000-0000-0000-0000-0000000000a7', 'instructor')$q$);
SELECT rls_test.t('1.27 admin promotes someone to admin (equal to own)', 'error',
  $q$SELECT update_member_role('30000000-0000-0000-0000-0000000000a5', 'admin')$q$);
SELECT rls_test.t('1.28 admin promotes someone to owner', 'error',
  $q$SELECT update_member_role('30000000-0000-0000-0000-0000000000a5', 'owner')$q$);
SELECT rls_test.t('1.29 admin demotes an owner', 'error',
  $q$SELECT update_member_role('30000000-0000-0000-0000-0000000000a1', 'staff')$q$);
SELECT rls_test.t('1.30 admin demotes manager2 to lead [legit]', 'ok',
  $q$SELECT update_member_role('30000000-0000-0000-0000-0000000000a8', 'lead')$q$);

SELECT rls_test.login('a1');  -- owner A
SELECT rls_test.t('1.31 owner promotes lead to admin [legit]', 'ok',
  $q$SELECT update_member_role('30000000-0000-0000-0000-0000000000a8', 'admin')$q$);
SELECT rls_test.t('1.32 owner grants owner', 'error',
  $q$SELECT update_member_role('30000000-0000-0000-0000-0000000000a5', 'owner')$q$);
SELECT rls_test.t('1.33 owner demotes another owner', 'error',
  $q$SELECT update_member_role('30000000-0000-0000-0000-0000000000a9', 'admin')$q$);
SELECT rls_test.t('1.34 owner demotes admin2 back to manager [legit]', 'ok',
  $q$SELECT update_member_role('30000000-0000-0000-0000-0000000000a8', 'manager')$q$);

SELECT rls_test.login('a4');  -- instructor A
SELECT rls_test.t('1.35 instructor changes a staff role', 'error',
  $q$SELECT update_member_role('30000000-0000-0000-0000-0000000000a5', 'staff')$q$);
SELECT rls_test.login('a6');  -- now lead A
SELECT rls_test.t('1.36 lead changes a role', 'error',
  $q$SELECT update_member_role('30000000-0000-0000-0000-0000000000a5', 'staff')$q$);

SELECT rls_test.login('a3');  -- manager A
SELECT rls_test.t('1.37 manager adds roster member as owner (create_roster_member)', 'error',
  $q$SELECT create_roster_member('20000000-0000-0000-0000-00000000000a', 'Evil', 'Owner', 'evil.owner@test.local', NULL, 'owner')$q$);
SELECT rls_test.t('1.38 manager adds roster member as manager', 'error',
  $q$SELECT create_roster_member('20000000-0000-0000-0000-00000000000a', 'Peer', 'Mgr', 'peer.mgr@test.local', NULL, 'manager')$q$);
SELECT rls_test.t('1.39 manager adds roster member as lead [legit]', 'ok',
  $q$SELECT create_roster_member('20000000-0000-0000-0000-00000000000a', 'New', 'Lead', 'new.lead@test.local', NULL, 'lead')$q$);
SELECT rls_test.t('1.40 manager adds a client by email (add_client_member) [legit]', 'true',
  $q$SELECT (add_client_member('20000000-0000-0000-0000-00000000000a', 'prober@test.local') ->> 'success')$q$);
SELECT rls_test.t('1.41 manager sets pay rate for a lead [legit]', 'ok',
  $q$SELECT set_member_pay_rate('30000000-0000-0000-0000-0000000000a6', 25)$q$);
SELECT rls_test.t('1.42 manager sets pay rate for an admin', 'error',
  $q$SELECT set_member_pay_rate('30000000-0000-0000-0000-0000000000a2', 99)$q$);
SELECT rls_test.t('1.43 manager sets own pay rate', 'error',
  $q$SELECT set_member_pay_rate('30000000-0000-0000-0000-0000000000a3', 99)$q$);
SELECT rls_test.login('a2');
SELECT rls_test.t('1.44 admin adds roster member as instructor [legit]', 'ok',
  $q$SELECT create_roster_member('20000000-0000-0000-0000-00000000000a', 'New', 'Instr', 'new.instr@test.local', NULL, 'instructor')$q$);
SELECT rls_test.t('1.45 admin deletes an owner''s membership directly', 'error',
  $q$DELETE FROM company_memberships WHERE id = '30000000-0000-0000-0000-0000000000a1'$q$);
SELECT rls_test.t('1.46 admin removes a client membership directly [legit]', '1',
  $q$WITH d AS (DELETE FROM company_memberships WHERE company_id = '20000000-0000-0000-0000-00000000000a' AND role = 'client' RETURNING 1) SELECT count(*) FROM d$q$);
SELECT rls_test.login('a6');
SELECT rls_test.t('1.47 lead calls add_client_member', 'error',
  $q$SELECT add_client_member('20000000-0000-0000-0000-00000000000a', 'staff.b@test.local')$q$);
SELECT rls_test.t('1.48 lead calls set_member_pay_rate on self', 'error',
  $q$SELECT set_member_pay_rate('30000000-0000-0000-0000-0000000000a6', 99)$q$);

-- ============================ 2. Timesheets ================================
SELECT rls_test.login('a7');  -- instructor (no supervisor rights over self)
SELECT rls_test.t('2.01 staff clock-in with forged past time and approved=true: stored with server time, unapproved', 'true',
  $q$WITH i AS (INSERT INTO timesheets (id, user_id, clock_in, approved, company_id, updated_at)
       VALUES ('40000000-0000-0000-0000-000000000010', get_my_user_id(), '2020-01-01 00:00', true, '20000000-0000-0000-0000-00000000000a', now())
       RETURNING clock_in, approved)
     SELECT (abs(extract(epoch FROM clock_in - (now() AT TIME ZONE 'utc'))) < 5 AND NOT approved)::text FROM i$q$);
SELECT rls_test.t('2.02 staff edits own clock_in', 'error',
  $q$UPDATE timesheets SET clock_in = '2020-01-01' WHERE id = '40000000-0000-0000-0000-000000000010'$q$);
SELECT rls_test.t('2.03 staff approves own timesheet', 'error',
  $q$UPDATE timesheets SET approved = true WHERE id = '40000000-0000-0000-0000-000000000010'$q$);
SELECT rls_test.t('2.04 staff clocks out with a forged future time: server time stored [legit]', 'true',
  $q$WITH u AS (UPDATE timesheets SET clock_out = '2030-01-01' WHERE id = '40000000-0000-0000-0000-000000000010' RETURNING clock_out)
     SELECT (abs(extract(epoch FROM clock_out - (now() AT TIME ZONE 'utc'))) < 5)::text FROM u$q$);
SELECT rls_test.t('2.05 staff changes clock_out after clocking out', 'error',
  $q$UPDATE timesheets SET clock_out = '2030-01-01' WHERE id = '40000000-0000-0000-0000-000000000010'$q$);
SELECT rls_test.t('2.06 staff edits notes on own timesheet [legit]', '1',
  $q$WITH u AS (UPDATE timesheets SET notes = 'gate 3' WHERE id = '40000000-0000-0000-0000-000000000010' RETURNING 1) SELECT count(*) FROM u$q$);
SELECT rls_test.t('2.07 staff deletes own timesheet (0 rows)', '0',
  $q$WITH d AS (DELETE FROM timesheets WHERE id = '40000000-0000-0000-0000-000000000010' RETURNING 1) SELECT count(*) FROM d$q$);
SELECT rls_test.t('2.08 staff clocks in against company B (not a member)', 'error',
  $q$INSERT INTO timesheets (id, user_id, clock_in, company_id, updated_at)
     VALUES (gen_random_uuid(), get_my_user_id(), now(), '20000000-0000-0000-0000-00000000000b', now())$q$);

SELECT rls_test.login('a3');  -- manager A
SELECT rls_test.t('2.09 manager approves a staff timesheet; approved_by forced to the manager [legit]', '10000000-0000-0000-0000-0000000000a3',
  $q$WITH u AS (UPDATE timesheets SET approved = true, approved_by_id = '10000000-0000-0000-0000-0000000000a1'
       WHERE id = '40000000-0000-0000-0000-000000000010' RETURNING approved_by_id) SELECT approved_by_id::text FROM u$q$);
SELECT rls_test.t('2.10 manager corrects clock_in (time change request) [legit]', '1',
  $q$WITH u AS (UPDATE timesheets SET clock_in = clock_in - interval '5 minutes' WHERE id = '40000000-0000-0000-0000-000000000001' RETURNING 1) SELECT count(*) FROM u$q$);
SELECT rls_test.t('2.11 manager edits a legacy timesheet with NULL company_id [legit]', '1',
  $q$WITH u AS (UPDATE timesheets SET approved = true WHERE id = '40000000-0000-0000-0000-000000000003' RETURNING 1) SELECT count(*) FROM u$q$);
SELECT rls_test.t('2.12 manager approves a company B timesheet (0 rows)', '0',
  $q$WITH u AS (UPDATE timesheets SET approved = true WHERE id = '40000000-0000-0000-0000-000000000002' RETURNING 1) SELECT count(*) FROM u$q$);
SELECT rls_test.t('2.13 manager creates a timesheet in A for a non-member (owner B)', 'error',
  $q$INSERT INTO timesheets (id, user_id, clock_in, company_id, updated_at)
     VALUES (gen_random_uuid(), '10000000-0000-0000-0000-0000000000b1', now(), '20000000-0000-0000-0000-00000000000a', now())$q$);
SELECT rls_test.t('2.14 manager creates a manual/QR timesheet for a member with explicit time [legit]', '2026-01-01 08:00:00',
  $q$WITH i AS (INSERT INTO timesheets (id, user_id, clock_in, clock_method, company_id, updated_at)
       VALUES (gen_random_uuid(), '10000000-0000-0000-0000-0000000000a5', '2026-01-01 08:00', 'qr_scan', '20000000-0000-0000-0000-00000000000a', now())
       RETURNING clock_in) SELECT clock_in::text FROM i$q$);
SELECT rls_test.t('2.15 manager clocks self in (staff rules on own row) [legit]', 'ok',
  $q$INSERT INTO timesheets (id, user_id, clock_in, company_id, updated_at)
     VALUES ('40000000-0000-0000-0000-000000000011', get_my_user_id(), now(), '20000000-0000-0000-0000-00000000000a', now())$q$);
SELECT rls_test.t('2.16 manager approves own timesheet', 'error',
  $q$UPDATE timesheets SET approved = true WHERE id = '40000000-0000-0000-0000-000000000011'$q$);
SELECT rls_test.t('2.17 manager deletes an erroneous staff clock-in [legit]', '1',
  $q$WITH d AS (DELETE FROM timesheets WHERE id = '40000000-0000-0000-0000-000000000010' RETURNING 1) SELECT count(*) FROM d$q$);

SELECT rls_test.login('a5');  -- breaker
SELECT rls_test.t('2.18 breaker approves a staff timesheet (0 rows)', '0',
  $q$WITH u AS (UPDATE timesheets SET approved = false WHERE id = '40000000-0000-0000-0000-000000000001' RETURNING 1) SELECT count(*) FROM u$q$);

-- ============================ 3. Join codes ================================
SELECT rls_test.login('c3');
SELECT rls_test.t('3.01 brute force: wrong code #1 returns an error object', 'Invalid company code', $q$SELECT join_company_by_code('AAAAAA') ->> 'error'$q$);
SELECT rls_test.t('3.02 wrong code #2', 'Invalid company code', $q$SELECT join_company_by_code('AAAAAB') ->> 'error'$q$);
SELECT rls_test.t('3.03 wrong code #3', 'Invalid company code', $q$SELECT join_company_by_code('AAAAAC') ->> 'error'$q$);
SELECT rls_test.t('3.04 wrong code #4', 'Invalid company code', $q$SELECT join_company_by_code('AAAAAD') ->> 'error'$q$);
SELECT rls_test.t('3.05 wrong code #5', 'Invalid company code', $q$SELECT join_company_by_code('AAAAAE') ->> 'error'$q$);
SELECT rls_test.t('3.06 6th attempt in 15 min is rate limited (failures are counted now)', 'error', $q$SELECT join_company_by_code('ABC234')$q$);
SELECT rls_test.t('3.07 user cannot delete own join_attempts to reset the limit (0 rows)', '0',
  $q$WITH d AS (DELETE FROM join_attempts RETURNING 1) SELECT count(*) FROM d$q$);
SELECT rls_test.t('3.08 user cannot insert join_attempts', 'error',
  $q$INSERT INTO join_attempts (supabase_id) VALUES (auth.uid()::text)$q$);
SELECT rls_test.t('3.09 companies.join_code no longer holds a usable code (placeholder)', 'true',
  $q$SELECT (join_code ~ '^x[0-9a-f]{32}$')::text FROM companies WHERE id = '20000000-0000-0000-0000-00000000000a'$q$);
SELECT rls_test.t('3.10 company_join_codes is not readable by clients', 'error',
  $q$SELECT count(*) FROM company_join_codes$q$);
SELECT rls_test.t('3.11 direct company insert (owner-less, chosen join code)', 'error',
  $q$INSERT INTO companies (id, name, slug, join_code, updated_at) VALUES (gen_random_uuid(), 'X', 'x-co', 'ZZZZZZ', now())$q$);

SELECT rls_test.login('a6');
SELECT rls_test.t('3.12 lead reads the join code (get_company_join_code)', 'error',
  $q$SELECT get_company_join_code('20000000-0000-0000-0000-00000000000a')$q$);
SELECT rls_test.login('a3');
SELECT rls_test.t('3.13 manager reads the join code [legit]', 'ABC234',
  $q$SELECT get_company_join_code('20000000-0000-0000-0000-00000000000a')$q$);
SELECT rls_test.t('3.14 manager rotates the join code', 'error',
  $q$SELECT rotate_company_join_code('20000000-0000-0000-0000-00000000000a')$q$);
SELECT rls_test.login('a2');
SELECT rls_test.t('3.15 admin rotates the join code to 10 chars [legit]', '10',
  $q$SELECT length(rotate_company_join_code('20000000-0000-0000-0000-00000000000a'))::text$q$);
SELECT rls_test.login('c1');
SELECT rls_test.t('3.16 the old code stops working after rotation', 'Invalid company code',
  $q$SELECT join_company_by_code('ABC234') ->> 'error'$q$);
SELECT rls_test.t('3.17 company creation limit: 3rd company in 24h [legit]', 'owner',
  $q$SELECT create_company_with_owner('Newbie Three') -> 'membership' ->> 'role'$q$);
SELECT rls_test.t('3.18 company creation limit: 4th company in 24h is refused', 'error',
  $q$SELECT create_company_with_owner('Newbie Four')$q$);
SELECT rls_test.anon();
SELECT rls_test.t('3.19 anon calls join_company_by_code', 'error', $q$SELECT join_company_by_code('ABC234', NULL)$q$);
SELECT rls_test.t('3.20 anon calls create_company_with_owner', 'error', $q$SELECT create_company_with_owner('Anon Co', NULL)$q$);

-- ============================ 4. Tenant isolation ==========================
SELECT rls_test.login('a6');
SELECT rls_test.t('4.01 lead edits company settings (0 rows)', '0',
  $q$WITH u AS (UPDATE companies SET settings = '{"x":1}' WHERE id = '20000000-0000-0000-0000-00000000000a' RETURNING 1) SELECT count(*) FROM u$q$);
SELECT rls_test.t('4.02 member updates radio state through set_company_radio_state [legit]', 'ok',
  $q$SELECT set_company_radio_state('20000000-0000-0000-0000-00000000000a', '{"ch":1}')$q$);
SELECT rls_test.t('4.03 lead sees only users who share a company (no company B staff)', '0',
  $q$SELECT count(*)::text FROM users WHERE supabase_id = '00000000-0000-0000-0000-0000000000b2'$q$);
SELECT rls_test.t('4.04 lead still sees co-workers [legit]', '1',
  $q$SELECT count(*)::text FROM users WHERE supabase_id = '00000000-0000-0000-0000-0000000000a1'$q$);
SELECT rls_test.t('4.05 user flips own is_platform_admin', 'error',
  $q$UPDATE users SET is_platform_admin = true WHERE supabase_id = auth.uid()::text$q$);
SELECT rls_test.t('4.06 user rewrites own supabase_id', 'error',
  $q$UPDATE users SET supabase_id = '00000000-0000-0000-0000-0000000000a1' WHERE supabase_id = auth.uid()::text$q$);
SELECT rls_test.t('4.07 user claims someone else''s email', 'error',
  $q$UPDATE users SET email = 'victim@test.local' WHERE supabase_id = auth.uid()::text$q$);
SELECT rls_test.t('4.08 user edits own name/callsign [legit]', '1',
  $q$WITH u AS (UPDATE users SET first_name = 'Officer', callsign = 'K9' WHERE supabase_id = auth.uid()::text RETURNING 1) SELECT count(*) FROM u$q$);
SELECT rls_test.t('4.09 member inserts an audit log row directly', 'error',
  $q$INSERT INTO audit_logs (id, company_id, action, entity_type) VALUES (gen_random_uuid(), '20000000-0000-0000-0000-00000000000a', 'forged', 'auth')$q$);
SELECT rls_test.t('4.10 member reads audit logs (0 rows)', '0', $q$SELECT count(*)::text FROM audit_logs$q$);
SELECT rls_test.t('4.11 member deletes audit logs', 'error', $q$DELETE FROM audit_logs$q$);
SELECT rls_test.t('4.12 log_audit_event with no company fans out to the caller''s companies (login fix) [legit]', '1',
  $q$SELECT log_audit_event('auth.login.success', 'success', NULL, '{"method":"email"}')::text$q$);
SELECT rls_test.t('4.13 log_audit_event for a company the caller is not in writes nothing', '0',
  $q$SELECT log_audit_event('auth.login.success', 'success', '20000000-0000-0000-0000-00000000000b')::text$q$);
SELECT rls_test.login('a1');
SELECT rls_test.t('4.14 owner edits company settings [legit]', '1',
  $q$WITH u AS (UPDATE companies SET settings = '{"x":1}' WHERE id = '20000000-0000-0000-0000-00000000000a' RETURNING 1) SELECT count(*) FROM u$q$);
SELECT rls_test.t('4.15 owner reads own company audit logs, incl. the login event [legit]', 'true',
  $q$SELECT (count(*) FILTER (WHERE event_type = 'auth.login.success') = 1 AND count(*) FILTER (WHERE company_id <> '20000000-0000-0000-0000-00000000000a') = 0)::text FROM audit_logs$q$);
SELECT rls_test.login('a3');
SELECT rls_test.t('4.16 manager edits company settings (0 rows)', '0',
  $q$WITH u AS (UPDATE companies SET name = 'pwned' WHERE id = '20000000-0000-0000-0000-00000000000a' RETURNING 1) SELECT count(*) FROM u$q$);
SELECT rls_test.login('b1');
SELECT rls_test.t('4.17 other company''s owner sets A radio state', 'error',
  $q$SELECT set_company_radio_state('20000000-0000-0000-0000-00000000000a', 'x')$q$);
SELECT rls_test.anon();
SELECT rls_test.t('4.18 anon calls log_audit_event', 'error', $q$SELECT log_audit_event('auth.login.failed', 'failure')$q$);

-- ============================ 5. Storage ===================================
SELECT rls_test.superuser();
SELECT rls_test.t('5.01 certifications and operation-maps buckets are private', '0',
  $q$SELECT count(*)::text FROM storage.buckets WHERE id IN ('certifications', 'operation-maps') AND public$q$);
SELECT rls_test.login('a6');
SELECT rls_test.t('5.02 user reads own certification file [legit]', '1',
  $q$SELECT count(*)::text FROM storage.objects WHERE bucket_id = 'certifications' AND name LIKE '00000000-0000-0000-0000-0000000000a6/%'$q$);
SELECT rls_test.t('5.03 user reads another company''s certification file (0)', '0',
  $q$SELECT count(*)::text FROM storage.objects WHERE bucket_id = 'certifications' AND name LIKE '00000000-0000-0000-0000-0000000000b2/%'$q$);
SELECT rls_test.t('5.04 member reads own company operation map [legit]', '1',
  $q$SELECT count(*)::text FROM storage.objects WHERE bucket_id = 'operation-maps' AND name LIKE '20000000-0000-0000-0000-00000000000a/%'$q$);
SELECT rls_test.t('5.05 member reads another company''s operation map (0)', '0',
  $q$SELECT count(*)::text FROM storage.objects WHERE bucket_id = 'operation-maps' AND name LIKE '20000000-0000-0000-0000-00000000000b/%'$q$);
SELECT rls_test.t('5.06 non-manager reads applicant documents (0)', '0',
  $q$SELECT count(*)::text FROM storage.objects WHERE bucket_id = 'applicant-documents'$q$);
SELECT rls_test.t('5.07 non-manager deletes applicant documents (0)', '0',
  $q$WITH d AS (DELETE FROM storage.objects WHERE bucket_id = 'applicant-documents' RETURNING 1) SELECT count(*) FROM d$q$);
SELECT rls_test.login('a3');
SELECT rls_test.t('5.08 manager reads a staff member''s certification [legit]', '1',
  $q$SELECT count(*)::text FROM storage.objects WHERE bucket_id = 'certifications' AND name LIKE '00000000-0000-0000-0000-0000000000a6/%'$q$);
SELECT rls_test.t('5.09 manager reads own company applicant documents only [legit]', '1',
  $q$SELECT count(*)::text FROM storage.objects WHERE bucket_id = 'applicant-documents'$q$);
SELECT rls_test.login('b1');
SELECT rls_test.t('5.10 other company''s owner reads A staff certification (0)', '0',
  $q$SELECT count(*)::text FROM storage.objects WHERE bucket_id = 'certifications' AND name LIKE '00000000-0000-0000-0000-0000000000a6/%'$q$);
SELECT rls_test.anon();
SELECT rls_test.t('5.11 anon applicant uploads to {company}/{applicant}/{file} [legit]', 'ok',
  $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('applicant-documents', '20000000-0000-0000-0000-00000000000a/60000000-0000-0000-0000-000000000009/id.pdf')$q$);
SELECT rls_test.t('5.12 anon upload to a company that does not exist', 'error',
  $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('applicant-documents', '29999999-0000-0000-0000-000000000000/60000000-0000-0000-0000-000000000009/x.pdf')$q$);
SELECT rls_test.t('5.13 anon upload outside the applicant folder layout', 'error',
  $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('applicant-documents', '20000000-0000-0000-0000-00000000000a/x.pdf')$q$);
SELECT rls_test.t('5.14 anon lists applicant documents (0)', '0',
  $q$SELECT count(*)::text FROM storage.objects WHERE bucket_id = 'applicant-documents'$q$);
SELECT rls_test.t('5.15 anon deletes applicant documents (0)', '0',
  $q$WITH d AS (DELETE FROM storage.objects WHERE bucket_id = 'applicant-documents' RETURNING 1) SELECT count(*) FROM d$q$);
SELECT rls_test.t('5.16 anon reads certifications (0)', '0',
  $q$SELECT count(*)::text FROM storage.objects WHERE bucket_id = 'certifications'$q$);

-- ============================ Summary ======================================
SELECT rls_test.superuser();
SELECT rls_test.t('S.01 failed join attempts were persisted (rate limit counts failures)', '5',
  $q$SELECT count(*)::text FROM join_attempts WHERE supabase_id = '00000000-0000-0000-0000-0000000000c3'$q$);

\pset pager off
SELECT n, CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, label, detail FROM rls_test.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS passed, count(*) FILTER (WHERE NOT ok) AS failed FROM rls_test.results;
