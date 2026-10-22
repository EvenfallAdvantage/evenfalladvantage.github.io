-- Advisor fix (function_search_path_mutable): pin search_path on post_orders_sha256.
-- Only new function from the field go-live with this warning. Rollback: rollback/20261020070607_post_orders_sha256_search_path.rollback.sql
ALTER FUNCTION public.post_orders_sha256(text, text) SET search_path = public;
