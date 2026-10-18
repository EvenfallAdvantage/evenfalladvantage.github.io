-- Rollback for 20261018180000_course_checkout.sql
BEGIN;
DROP TRIGGER IF EXISTS course_enrollment_payment_guard ON public.course_enrollments;
DROP FUNCTION IF EXISTS public.course_enrollment_payment_guard();
DROP FUNCTION IF EXISTS public.record_course_purchase(uuid, text, text, integer, text);
DROP FUNCTION IF EXISTS public.record_course_payment_status(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.record_course_refund(text, integer, boolean);
ALTER TABLE public.payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_status_check;
DROP INDEX IF EXISTS public.payment_transactions_checkout_session_key;
-- Restores the previous (client-insert) policy and grants exactly as they were.
CREATE POLICY "Users insert own payments" ON public.payment_transactions
  FOR INSERT WITH CHECK (user_id = (SELECT (SELECT auth.uid() AS uid) AS uid));
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.payment_transactions TO anon, authenticated;
ALTER TABLE public.payment_transactions
  DROP COLUMN IF EXISTS stripe_checkout_session_id,
  DROP COLUMN IF EXISTS completed_at,
  DROP COLUMN IF EXISTS refunded_at,
  DROP COLUMN IF EXISTS refund_amount,
  DROP COLUMN IF EXISTS error_message;
COMMIT;
