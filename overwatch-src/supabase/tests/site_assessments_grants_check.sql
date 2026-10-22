-- Rolled-back verification: applies the migration inside the transaction, checks roles, then RAISEs so nothing commits.
-- site_assessments: align grants with the table-grant rule.
-- anon: no access (only signed-in company managers use this table; the read
-- policy already requires auth.uid()). authenticated/service_role: CRUD only.
REVOKE ALL ON TABLE public.site_assessments FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.site_assessments FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.site_assessments TO authenticated, service_role;
ALTER TABLE public.site_assessments ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE cid uuid; sid text; ok text; t text; an text; priv text;
BEGIN
  select string_agg(grantee||':'||privilege_type, ',' order by grantee,privilege_type) into priv
    from information_schema.role_table_grants where table_schema='public' and table_name='site_assessments' and grantee in ('anon','authenticated','service_role');
  select id into cid from public.companies where name ilike 'ZZTEST Field QA%' limit 1;
  select supabase_id into sid from public.users where email='evenfall-icarus+zztest-field@mail.grokbot.com';
  perform set_config('request.jwt.claims', json_build_object('sub',sid,'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
  begin insert into public.site_assessments(company_id,data,risk_level,created_by,client_name) values (cid,'{}','low',sid::uuid,'ZZTEST grants'); 
        update public.site_assessments set risk_level='high' where client_name='ZZTEST grants';
        perform 1 from public.site_assessments where client_name='ZZTEST grants';
        delete from public.site_assessments where client_name='ZZTEST grants'; ok:='mgr CRUD ok';
  exception when others then ok:='mgr ERR '||sqlstate; end;
  begin execute 'truncate public.site_assessments'; t:='auth TRUNCATE ALLOWED'; exception when insufficient_privilege then t:='auth TRUNCATE denied'; end;
  perform set_config('role','anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin perform 1 from public.site_assessments limit 1; an:='anon SELECT ALLOWED'; exception when insufficient_privilege then an:='anon SELECT denied'; end;
  begin insert into public.site_assessments(company_id,data) values (cid,'{}'); an:=an||', anon INSERT ALLOWED'; exception when insufficient_privilege then an:=an||', anon INSERT denied'; end;
  raise exception 'RESULTS grants=[%] | % | % | %', priv, ok, t, an;
END $$;