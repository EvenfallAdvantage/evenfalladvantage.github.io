-- VAPID keys live in Supabase Vault (never in env, repo, logs or responses).
-- 1) vapid_store_keys: one-time writer used by the vapid-init edge function. Refuses if keys exist.
-- 2) get_vapid_keys: runtime reader for push-send (service_role only).
-- 3) get_vapid_public_key: PUBLIC key only (public by design; browsers need it to subscribe).

create or replace function public.vapid_store_keys(p_public text, p_private text, p_subject text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from vault.secrets where name in ('VAPID_PRIVATE_KEY','VAPID_PUBLIC_KEY')) then
    raise exception 'VAPID keys already exist';
  end if;
  if length(p_public) <> 87 or length(p_private) <> 43 then
    raise exception 'bad key format';
  end if;
  perform vault.create_secret(p_public, 'VAPID_PUBLIC_KEY', 'Web Push VAPID public key (base64url raw P-256)');
  perform vault.create_secret(p_private, 'VAPID_PRIVATE_KEY', 'Web Push VAPID private key (base64url d)');
  if not exists (select 1 from vault.secrets where name = 'VAPID_SUBJECT') then
    perform vault.create_secret(p_subject, 'VAPID_SUBJECT', 'Web Push VAPID subject');
  end if;
end $$;
revoke all on function public.vapid_store_keys(text,text,text) from public, anon, authenticated;
grant execute on function public.vapid_store_keys(text,text,text) to service_role;

create or replace function public.get_vapid_keys()
returns table (public_key text, private_key text, subject text)
language sql stable security definer set search_path = '' as $$
  select
    (select decrypted_secret from vault.decrypted_secrets where name = 'VAPID_PUBLIC_KEY' limit 1),
    (select decrypted_secret from vault.decrypted_secrets where name = 'VAPID_PRIVATE_KEY' limit 1),
    (select decrypted_secret from vault.decrypted_secrets where name = 'VAPID_SUBJECT' limit 1);
$$;
revoke all on function public.get_vapid_keys() from public, anon, authenticated;
grant execute on function public.get_vapid_keys() to service_role;

create or replace function public.get_vapid_public_key()
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'VAPID_PUBLIC_KEY' limit 1;
$$;
revoke all on function public.get_vapid_public_key() from public;
grant execute on function public.get_vapid_public_key() to anon, authenticated, service_role;
