ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS segment text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS converted_at timestamp with time zone;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS converted_by uuid;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS postal_code text;

ALTER TYPE public.lead_stage ADD VALUE IF NOT EXISTS 'convertido';

CREATE INDEX IF NOT EXISTS idx_leads_state ON public.leads (state);
CREATE INDEX IF NOT EXISTS idx_leads_city ON public.leads (city);
CREATE INDEX IF NOT EXISTS idx_customers_state ON public.customers (state);
CREATE INDEX IF NOT EXISTS idx_customers_city ON public.customers (city);