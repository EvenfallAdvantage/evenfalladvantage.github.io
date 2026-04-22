-- Shift Swap / Trade / Pickup Marketplace
-- Creates the shift_swap_requests table and RLS policies

CREATE TABLE IF NOT EXISTS public.shift_swap_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.users(id),
  replacement_id UUID REFERENCES public.users(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'approved', 'rejected', 'cancelled')),
  reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shift_swap_status ON public.shift_swap_requests(status);
CREATE INDEX IF NOT EXISTS idx_shift_swap_requester ON public.shift_swap_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_shift_swap_shift ON public.shift_swap_requests(shift_id);

ALTER TABLE public.shift_swap_requests ENABLE ROW LEVEL SECURITY;

-- Staff can read swap requests for their company's shifts
CREATE POLICY shift_swap_select ON public.shift_swap_requests FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.shifts s
    JOIN public.events e ON e.id = s.event_id
    JOIN public.company_memberships cm ON cm.company_id = e.company_id
    JOIN public.users u ON u.id = cm.user_id
    WHERE s.id = shift_swap_requests.shift_id
      AND u.supabase_id = auth.uid()::text
  ));

-- Staff can create swap requests for their own shifts
CREATE POLICY shift_swap_insert ON public.shift_swap_requests FOR INSERT
  WITH CHECK (requester_id IN (
    SELECT u.id FROM public.users u WHERE u.supabase_id = auth.uid()::text
  ));

-- Staff can update (claim/cancel) their own requests; managers can approve/reject
CREATE POLICY shift_swap_update ON public.shift_swap_requests FOR UPDATE
  USING (
    requester_id IN (SELECT u.id FROM public.users u WHERE u.supabase_id = auth.uid()::text)
    OR EXISTS (
      SELECT 1 FROM public.shifts s
      JOIN public.events e ON e.id = s.event_id
      JOIN public.company_memberships cm ON cm.company_id = e.company_id
      JOIN public.users u ON u.id = cm.user_id
      WHERE s.id = shift_swap_requests.shift_id
        AND u.supabase_id = auth.uid()::text
        AND cm.role IN ('owner', 'admin', 'manager')
    )
  );
