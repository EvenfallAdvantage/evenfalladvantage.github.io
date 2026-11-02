DROP POLICY IF EXISTS invoices_select_client ON public.invoices;
ALTER TABLE public.invoices DROP COLUMN IF EXISTS details;
