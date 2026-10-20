-- Rollback for 20261020040000_vapid_vault. Drops helpers; leaves Vault secrets in place.
-- To also remove the keys (push will stop until regenerated):
--   delete from vault.secrets where name in ('VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT');
drop function if exists public.vapid_store_keys(text,text,text);
drop function if exists public.get_vapid_keys();
drop function if exists public.get_vapid_public_key();
