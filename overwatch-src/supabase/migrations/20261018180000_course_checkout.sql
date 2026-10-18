-- =============================================================================
-- Course checkout on OverwatchDB (replaces the EADB Stripe functions, PR #70)
--
-- * payment_transactions: Stripe Checkout session id, completion/refund
--   fields, a status check, and NO client writes (users could forge a
--   "completed" payment before).
-- * course_enrollments: a guard trigger so members can't self-enroll in a
--   PAID course, set payment fields, or revive a refunded enrollment. Course
--   managers (training_can_manage) and the service role are unaffected.
-- * service-role-only functions the Stripe webhook calls:
--     record_course_purchase       paid session  -> payment completed + paid enrollment (idempotent)
--     record_course_payment_status pending/processing -> failed / expired / cancelled
--     record_course_refund         charge.refunded -> refunded (+ enrollment cancelled when full)
-- Prices stay the imported courses.price values (USD).
-- =============================================================================

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.payment_transactions') IS NULL
     OR to_regclass('public.course_enrollments') IS NULL
     OR to_regclass('public.courses') IS NULL
     OR to_regprocedure('public.training_can_manage(uuid)') IS NULL THEN
    RAISE EXCEPTION 'course_checkout: prerequisite training schema missing';
  END IF;
END
$guard$;

-- ── payment_transactions ────────────────────────────────────────────────────
ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS completed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_at   timestamptz,
  ADD COLUMN IF NOT EXISTS refund_amount numeric,
  ADD COLUMN IF NOT EXISTS error_message text;

CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_checkout_session_key
  ON public.payment_transactions (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

ALTER TABLE public.payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_status_check;
ALTER TABLE public.payment_transactions ADD CONSTRAINT payment_transactions_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired', 'cancelled', 'refunded'));

-- Only the service role (edge functions) writes payments.
DROP POLICY IF EXISTS "Users insert own payments" ON public.payment_transactions;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.payment_transactions FROM anon, authenticated;

-- ── course_enrollments guard ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.course_enrollment_payment_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_role    text := coalesce((SELECT auth.role()), '');
  v_company uuid;
  v_price   numeric;
BEGIN
  -- Service role (edge functions), migrations and SQL admin are not limited.
  IF v_role NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  SELECT c.company_id, coalesce(c.price, 0) INTO v_company, v_price
    FROM public.courses c WHERE c.id = NEW.course_id;

  IF v_company IS NOT NULL AND public.training_can_manage(v_company) THEN
    RETURN NEW; -- instructors/admins assign and comp enrollments
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_price > 0 THEN
      RAISE EXCEPTION 'Paid courses are enrolled through checkout' USING ERRCODE = '42501';
    END IF;
    IF coalesce(NEW.enrollment_type, 'free') NOT IN ('free', 'assigned')
       OR NEW.amount_paid IS NOT NULL OR NEW.payment_ref IS NOT NULL THEN
      RAISE EXCEPTION 'Payment fields are set by checkout only' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NEW.course_id IS DISTINCT FROM OLD.course_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.enrollment_type IS DISTINCT FROM OLD.enrollment_type
       OR NEW.amount_paid IS DISTINCT FROM OLD.amount_paid
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.payment_ref IS DISTINCT FROM OLD.payment_ref
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
      RAISE EXCEPTION 'Payment fields are set by checkout only' USING ERRCODE = '42501';
    END IF;
    IF OLD.status = 'cancelled' AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'This enrollment was cancelled' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END
$fn$;

REVOKE ALL ON FUNCTION public.course_enrollment_payment_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS course_enrollment_payment_guard ON public.course_enrollments;
CREATE TRIGGER course_enrollment_payment_guard
  BEFORE INSERT OR UPDATE ON public.course_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.course_enrollment_payment_guard();

-- ── webhook functions (service role only) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_course_purchase(
  p_payment_id     uuid,
  p_session_id     text,
  p_payment_intent text,
  p_amount_cents   integer,
  p_currency       text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  r      public.payment_transactions%ROWTYPE;
  v_user uuid;
BEGIN
  SELECT * INTO r FROM public.payment_transactions WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'unknown_payment'; END IF;
  IF r.status = 'completed' THEN RETURN 'already_completed'; END IF;
  IF r.status = 'refunded' THEN RETURN 'already_refunded'; END IF;
  IF r.stripe_checkout_session_id IS DISTINCT FROM p_session_id THEN RETURN 'session_mismatch'; END IF;

  IF round(r.amount * 100)::integer <> p_amount_cents THEN
    UPDATE public.payment_transactions SET error_message = format('amount_mismatch: charged %s cents', p_amount_cents), updated_at = now() WHERE id = r.id;
    RETURN 'amount_mismatch';
  END IF;
  IF lower(coalesce(p_currency, '')) <> lower(r.currency) THEN
    UPDATE public.payment_transactions SET error_message = format('currency_mismatch: %s', p_currency), updated_at = now() WHERE id = r.id;
    RETURN 'currency_mismatch';
  END IF;

  SELECT u.id INTO v_user FROM public.users u WHERE u.supabase_id = r.user_id::text LIMIT 1;
  IF v_user IS NULL OR r.course_id IS NULL THEN
    UPDATE public.payment_transactions SET error_message = 'no_overwatch_user_or_course', updated_at = now() WHERE id = r.id;
    RETURN 'no_user_or_course';
  END IF;

  UPDATE public.payment_transactions
     SET status = 'completed', completed_at = now(), error_message = NULL, updated_at = now(),
         stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id)
   WHERE id = r.id;

  INSERT INTO public.course_enrollments AS e
         (id, course_id, user_id, status, assigned_at, enrollment_type, amount_paid, currency, payment_ref)
  VALUES (gen_random_uuid(), r.course_id, v_user, 'active', now(), 'paid', r.amount, lower(r.currency), p_session_id)
  ON CONFLICT (course_id, user_id) DO UPDATE
     SET enrollment_type = 'paid', amount_paid = EXCLUDED.amount_paid, currency = EXCLUDED.currency,
         payment_ref = EXCLUDED.payment_ref, expires_at = NULL,
         status = CASE WHEN e.status = 'cancelled' THEN 'active' ELSE e.status END;
  RETURN 'fulfilled';
END
$fn$;

CREATE OR REPLACE FUNCTION public.record_course_payment_status(
  p_payment_id uuid,
  p_session_id text,
  p_status     text,
  p_error      text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE n integer;
BEGIN
  IF p_status NOT IN ('failed', 'expired', 'cancelled') THEN RETURN 'bad_status'; END IF;
  UPDATE public.payment_transactions
     SET status = p_status, error_message = p_error, updated_at = now()
   WHERE id = p_payment_id AND stripe_checkout_session_id = p_session_id
     AND status IN ('pending', 'processing');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN CASE WHEN n = 1 THEN 'updated' ELSE 'unchanged' END;
END
$fn$;

CREATE OR REPLACE FUNCTION public.record_course_refund(
  p_payment_intent text,
  p_refunded_cents integer,
  p_full           boolean
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  r      public.payment_transactions%ROWTYPE;
  v_user uuid;
BEGIN
  SELECT * INTO r FROM public.payment_transactions
   WHERE stripe_payment_intent_id = p_payment_intent AND status IN ('completed', 'refunded')
   ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN 'unknown_payment'; END IF;

  UPDATE public.payment_transactions
     SET refund_amount = p_refunded_cents / 100.0, refunded_at = now(), updated_at = now(),
         status = CASE WHEN p_full THEN 'refunded' ELSE status END
   WHERE id = r.id;

  IF p_full THEN
    SELECT u.id INTO v_user FROM public.users u WHERE u.supabase_id = r.user_id::text LIMIT 1;
    UPDATE public.course_enrollments
       SET status = 'cancelled', expires_at = now()
     WHERE course_id = r.course_id AND user_id = v_user AND enrollment_type = 'paid';
    RETURN 'refunded';
  END IF;
  RETURN 'partial_refund_recorded';
END
$fn$;

REVOKE ALL ON FUNCTION public.record_course_purchase(uuid, text, text, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_course_payment_status(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_course_refund(text, integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_course_purchase(uuid, text, text, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_course_payment_status(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_course_refund(text, integer, boolean) TO service_role;

COMMIT;
