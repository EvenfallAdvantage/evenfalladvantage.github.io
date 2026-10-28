-- TomTom API key lives in Supabase Vault (never in repo, logs or client bundle).
-- get_tomtom_api_key(): runtime reader for intel-traffic (service_role only).
create or replace function public.get_tomtom_api_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'TOMTOM_API_KEY'
  limit 1;
$$;

revoke all on function public.get_tomtom_api_key() from public, anon, authenticated;
grant execute on function public.get_tomtom_api_key() to service_role;
