SELECT cron.unschedule('guard-card-expiry-reminders');
DROP FUNCTION IF EXISTS public.guard_card_expiry_reminders();
