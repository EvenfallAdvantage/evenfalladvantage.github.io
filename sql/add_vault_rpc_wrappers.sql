-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  VAULT RPC WRAPPERS                                               ║
-- ║                                                                   ║
-- ║  supabase-js .rpc() can only call functions in the `public`       ║
-- ║  schema. Supabase Vault exposes vault.create_secret() and         ║
-- ║  vault.update_secret() in the vault schema, so we wrap them with  ║
-- ║  thin SECURITY DEFINER functions in public.                       ║
-- ║                                                                   ║
-- ║  EXECUTE is locked to the service_role role — these MUST NEVER    ║
-- ║  be callable by anon / authenticated. The Edge Functions that     ║
-- ║  manage email provider creds use the service-role key.            ║
-- ║                                                                   ║
-- ║  Idempotent.                                                      ║
-- ╚══════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.vault_read_secret(
  p_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret
    INTO v_secret
    FROM vault.decrypted_secrets
   WHERE id = p_id;
  RETURN v_secret;
END;
$$;

CREATE OR REPLACE FUNCTION public.vault_create_secret(
  p_secret      text,
  p_name        text,
  p_description text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- vault.create_secret(secret text, name text, description text) returns uuid.
  v_id := vault.create_secret(p_secret, p_name, p_description);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.vault_update_secret(
  p_id          uuid,
  p_secret      text,
  p_name        text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- vault.update_secret(id uuid, new_secret text, new_name text, new_description text)
  PERFORM vault.update_secret(p_id, p_secret, p_name, p_description);
END;
$$;

CREATE OR REPLACE FUNCTION public.vault_delete_secret(
  p_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM vault.secrets WHERE id = p_id;
END;
$$;

-- Lock down EXECUTE: only service_role may call these. PUBLIC default is
-- revoked; authenticated and anon get nothing.
REVOKE EXECUTE ON FUNCTION public.vault_read_secret(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.vault_create_secret(text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.vault_update_secret(uuid, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.vault_delete_secret(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.vault_read_secret(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.vault_create_secret(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.vault_update_secret(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.vault_delete_secret(uuid) TO service_role;

COMMENT ON FUNCTION public.vault_read_secret(uuid) IS
  'Service-role-only wrapper around vault.decrypted_secrets. Returns the decrypted secret payload as text (typically JSON).';
COMMENT ON FUNCTION public.vault_create_secret(text, text, text) IS
  'Service-role-only wrapper around vault.create_secret. Used by Edge Functions to store per-company email provider credentials encrypted at rest.';
COMMENT ON FUNCTION public.vault_update_secret(uuid, text, text, text) IS
  'Service-role-only wrapper around vault.update_secret.';
COMMENT ON FUNCTION public.vault_delete_secret(uuid) IS
  'Service-role-only wrapper to remove a vault secret by id.';
