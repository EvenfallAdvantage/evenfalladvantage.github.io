-- One-time writer no longer needed after keys were created in Vault.
drop function if exists public.vapid_store_keys(text,text,text);
