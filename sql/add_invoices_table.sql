-- Invoicing System
-- Creates the invoices table and adds bill_rate to events/companies

-- Add bill_rate columns (separate from pay_rate — client-facing rate)
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS bill_rate NUMERIC;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_bill_rate NUMERIC;

-- Invoices table
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

-- Company admins can manage invoices
CREATE POLICY invoices_select ON public.invoices FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.company_id = invoices.company_id
      AND u.supabase_id = auth.uid()
      AND cm.role IN ('owner', 'admin', 'manager')
  ));

CREATE POLICY invoices_insert ON public.invoices FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.company_id = invoices.company_id
      AND u.supabase_id = auth.uid()
      AND cm.role IN ('owner', 'admin', 'manager')
  ));

CREATE POLICY invoices_update ON public.invoices FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.company_id = invoices.company_id
      AND u.supabase_id = auth.uid()
      AND cm.role IN ('owner', 'admin', 'manager')
  ));

CREATE POLICY invoices_delete ON public.invoices FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.company_id = invoices.company_id
      AND u.supabase_id = auth.uid()
      AND cm.role IN ('owner', 'admin')
  ) AND status = 'draft');
