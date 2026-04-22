-- Panic / SOS Alert System
-- Creates the panic_alerts table and RLS policies

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

-- Staff can create alerts for themselves
CREATE POLICY panic_insert ON public.panic_alerts FOR INSERT
  WITH CHECK (user_id IN (
    SELECT u.id FROM public.users u WHERE u.supabase_id = auth.uid()::text
  ));

-- Company members can read alerts
CREATE POLICY panic_select ON public.panic_alerts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.company_id = panic_alerts.company_id
      AND u.supabase_id = auth.uid()::text
  ));

-- Managers can update (acknowledge/resolve) alerts
CREATE POLICY panic_update ON public.panic_alerts FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.company_id = panic_alerts.company_id
      AND u.supabase_id = auth.uid()::text
      AND cm.role IN ('owner', 'admin', 'manager')
  ));
