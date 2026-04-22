-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  Combined Migration: Shift Swaps + Panic Alerts + Invoices     ║
-- ║  Run in Supabase SQL Editor — April 21, 2026                   ║
-- ║                                                                 ║
-- ║  IMPORTANT: users.supabase_id is TEXT, auth.uid() returns UUID  ║
-- ║  All comparisons use auth.uid()::text for proper casting.       ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════
-- 1. INVOICES TABLE + BILL RATE COLUMNS
-- ═══════════════════════════════════════════════════════════════════

-- Add bill_rate columns (separate from pay_rate — client-facing rate)
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS bill_rate NUMERIC;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_bill_rate NUMERIC;

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  invoice_number TEXT NOT NULL,
  client_name TEXT NOT NULL DEFAULT '',
  client_email TEXT DEFAULT '',
  event_id UUID REFERENCES public.events(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled')),
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  due_date DATE,
  paid_date DATE,
  notes TEXT DEFAULT '',
  line_items JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_company ON public.invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(company_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(company_id, invoice_number);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_select ON public.invoices FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.company_id = invoices.company_id
      AND u.supabase_id = auth.uid()::text
      AND cm.role IN ('owner', 'admin', 'manager')
  ));

CREATE POLICY invoices_insert ON public.invoices FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.company_id = invoices.company_id
      AND u.supabase_id = auth.uid()::text
      AND cm.role IN ('owner', 'admin', 'manager')
  ));

CREATE POLICY invoices_update ON public.invoices FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.company_id = invoices.company_id
      AND u.supabase_id = auth.uid()::text
      AND cm.role IN ('owner', 'admin', 'manager')
  ));

CREATE POLICY invoices_delete ON public.invoices FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.company_id = invoices.company_id
      AND u.supabase_id = auth.uid()::text
      AND cm.role IN ('owner', 'admin')
  ) AND status = 'draft');


-- ═══════════════════════════════════════════════════════════════════
-- 2. PANIC ALERTS TABLE
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.panic_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'false_alarm')),
  acknowledged_by UUID REFERENCES public.users(id),
  acknowledged_at TIMESTAMPTZ,
  escalated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_panic_company_status ON public.panic_alerts(company_id, status);
CREATE INDEX IF NOT EXISTS idx_panic_user ON public.panic_alerts(user_id);

ALTER TABLE public.panic_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY panic_insert ON public.panic_alerts FOR INSERT
  WITH CHECK (user_id IN (
    SELECT u.id FROM public.users u WHERE u.supabase_id = auth.uid()::text
  ));

CREATE POLICY panic_select ON public.panic_alerts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.company_id = panic_alerts.company_id
      AND u.supabase_id = auth.uid()::text
  ));

CREATE POLICY panic_update ON public.panic_alerts FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.company_id = panic_alerts.company_id
      AND u.supabase_id = auth.uid()::text
      AND cm.role IN ('owner', 'admin', 'manager')
  ));


-- ═══════════════════════════════════════════════════════════════════
-- 3. SHIFT SWAP REQUESTS TABLE
-- ═══════════════════════════════════════════════════════════════════

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

CREATE POLICY shift_swap_select ON public.shift_swap_requests FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.shifts s
    JOIN public.events e ON e.id = s.event_id
    JOIN public.company_memberships cm ON cm.company_id = e.company_id
    JOIN public.users u ON u.id = cm.user_id
    WHERE s.id = shift_swap_requests.shift_id
      AND u.supabase_id = auth.uid()::text
  ));

CREATE POLICY shift_swap_insert ON public.shift_swap_requests FOR INSERT
  WITH CHECK (requester_id IN (
    SELECT u.id FROM public.users u WHERE u.supabase_id = auth.uid()::text
  ));

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


-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════

SELECT 'invoices' AS tbl, count(*) FROM public.invoices
UNION ALL
SELECT 'panic_alerts', count(*) FROM public.panic_alerts
UNION ALL
SELECT 'shift_swap_requests', count(*) FROM public.shift_swap_requests;
