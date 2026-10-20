-- Rollback for 20261020031000_push_subscriptions.
BEGIN;
DROP TABLE IF EXISTS public.push_subscriptions;
COMMIT;
