-- Auto-Scheduling: Shift Templates
-- Creates the shift_templates table for recurring shift patterns

CREATE TABLE IF NOT EXISTS public.shift_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  role TEXT NOT NULL DEFAULT 'Security',
  start_time TEXT NOT NULL,          -- HH:MM format
  end_time TEXT NOT NULL,            -- HH:MM format
  days_of_week JSONB DEFAULT '[1,2,3,4,5]',  -- Mon-Fri default
  recurrence TEXT NOT NULL DEFAULT 'weekly' CHECK (recurrence IN ('daily', 'weekly', 'biweekly', 'monthly')),
  required_certs JSONB DEFAULT '[]',
  min_staff INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add template_id to shifts for tracking which template generated them
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.shift_templates(id);

CREATE INDEX IF NOT EXISTS idx_shift_templates_event ON public.shift_templates(event_id);
CREATE INDEX IF NOT EXISTS idx_shift_templates_company ON public.shift_templates(company_id);

ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;

-- Managers can manage templates
CREATE POLICY shift_templates_select ON public.shift_templates FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.company_id = shift_templates.company_id
      AND u.supabase_id = auth.uid()::text
      AND cm.role IN ('owner', 'admin', 'manager')
  ));

CREATE POLICY shift_templates_insert ON public.shift_templates FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.company_id = shift_templates.company_id
      AND u.supabase_id = auth.uid()::text
      AND cm.role IN ('owner', 'admin', 'manager')
  ));

CREATE POLICY shift_templates_update ON public.shift_templates FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.company_id = shift_templates.company_id
      AND u.supabase_id = auth.uid()::text
      AND cm.role IN ('owner', 'admin', 'manager')
  ));

CREATE POLICY shift_templates_delete ON public.shift_templates FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.company_id = shift_templates.company_id
      AND u.supabase_id = auth.uid()::text
      AND cm.role IN ('owner', 'admin', 'manager')
  ));

-- Verification
SELECT 'shift_templates' AS tbl, count(*) FROM public.shift_templates;
