-- Field top-10 #9: "My Post" acknowledgement of post orders.
-- The server fingerprints exactly what was acknowledged (operation + shift post
-- orders), so an edit to the orders makes the acknowledgement stale.
-- NOT applied by the PR.

CREATE TABLE IF NOT EXISTS public.post_order_acks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  event_id uuid NOT NULL,
  shift_id uuid NOT NULL,
  user_id uuid NOT NULL,
  orders_sha256 text NOT NULL,
  acked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shift_id, user_id, orders_sha256)
);
CREATE INDEX IF NOT EXISTS post_order_acks_event_idx ON public.post_order_acks (event_id, shift_id);
ALTER TABLE public.post_order_acks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS post_order_acks_select ON public.post_order_acks;
CREATE POLICY post_order_acks_select ON public.post_order_acks FOR SELECT TO authenticated
  USING (user_id = public.get_my_user_id() OR public.is_company_admin(company_id));
-- Writes only through ack_post_orders().
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.post_order_acks FROM anon, authenticated;
GRANT SELECT ON public.post_order_acks TO authenticated;

CREATE OR REPLACE FUNCTION public.post_orders_sha256(p_event_orders text, p_shift_orders text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(sha256(convert_to(coalesce(p_event_orders, '') || E'\n--\n' || coalesce(p_shift_orders, ''), 'UTF8')), 'hex')
$$;

CREATE OR REPLACE FUNCTION public.ack_post_orders(p_shift_id uuid)
RETURNS public.post_order_acks LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := public.get_my_user_id(); r record; v_hash text; v_row public.post_order_acks;
BEGIN
  SELECT s.id, s.assigned_user_id, s.post_orders AS so, e.id AS event_id, e.company_id, e.post_orders AS eo
    INTO r FROM public.shifts s JOIN public.events e ON e.id = s.event_id WHERE s.id = p_shift_id;
  IF r.id IS NULL OR v_me IS NULL OR r.assigned_user_id IS DISTINCT FROM v_me THEN
    RAISE EXCEPTION 'not your shift' USING ERRCODE = '42501';
  END IF;
  v_hash := public.post_orders_sha256(r.eo, r.so);
  INSERT INTO public.post_order_acks(company_id, event_id, shift_id, user_id, orders_sha256)
  VALUES (r.company_id, r.event_id, r.id, v_me, v_hash)
  ON CONFLICT (shift_id, user_id, orders_sha256) DO UPDATE SET acked_at = public.post_order_acks.acked_at
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

-- Latest acknowledgement per shift, and whether it covers the CURRENT orders.
CREATE OR REPLACE FUNCTION public.post_order_ack_status(p_shift_ids uuid[])
RETURNS TABLE (shift_id uuid, user_id uuid, acked_at timestamptz, is_current boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (s.id) s.id, a.user_id, a.acked_at,
         a.orders_sha256 = public.post_orders_sha256(e.post_orders, s.post_orders)
  FROM public.shifts s
  JOIN public.events e ON e.id = s.event_id
  JOIN public.post_order_acks a ON a.shift_id = s.id AND a.user_id = s.assigned_user_id
  WHERE s.id = ANY (p_shift_ids)
    AND (s.assigned_user_id = public.get_my_user_id() OR public.is_company_admin(e.company_id))
  ORDER BY s.id, a.acked_at DESC
$$;

REVOKE ALL ON FUNCTION public.ack_post_orders(uuid), public.post_order_ack_status(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ack_post_orders(uuid), public.post_order_ack_status(uuid[]), public.post_orders_sha256(text, text) TO authenticated;
