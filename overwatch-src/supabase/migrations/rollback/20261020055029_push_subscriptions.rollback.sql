-- Rollback for 20261020055029_push_subscriptions.
BEGIN;
DROP TABLE IF EXISTS public.push_subscriptions;
COMMIT;
