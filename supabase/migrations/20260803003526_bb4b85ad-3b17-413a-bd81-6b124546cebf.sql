-- Sequências para os identificadores legíveis
CREATE SEQUENCE IF NOT EXISTS public.lead_code_seq;
CREATE SEQUENCE IF NOT EXISTS public.customer_code_seq;
CREATE SEQUENCE IF NOT EXISTS public.opportunity_code_seq;

-- LEADS
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_code text,
  ADD COLUMN IF NOT EXISTS cnpj text;

ALTER TABLE public.leads
  ALTER COLUMN lead_code SET DEFAULT 'LEAD-' || lpad(nextval('public.lead_code_seq')::text, 6, '0');

-- CLIENTES
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS customer_code text,
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

ALTER TABLE public.customers
  ALTER COLUMN customer_code SET DEFAULT 'CLI-' || lpad(nextval('public.customer_code_seq')::text, 6, '0');

-- OPORTUNIDADES
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS opportunity_code text;

ALTER TABLE public.opportunities
  ALTER COLUMN opportunity_code SET DEFAULT 'OPO-' || lpad(nextval('public.opportunity_code_seq')::text, 6, '0');

-- Backfill dos registros existentes (ordem de criação)
WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
  FROM public.leads WHERE lead_code IS NULL
)
UPDATE public.leads l
SET lead_code = 'LEAD-' || lpad(o.rn::text, 6, '0')
FROM ordered o WHERE o.id = l.id;

WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
  FROM public.customers WHERE customer_code IS NULL
)
UPDATE public.customers c
SET customer_code = 'CLI-' || lpad(o.rn::text, 6, '0')
FROM ordered o WHERE o.id = c.id;

WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
  FROM public.opportunities WHERE opportunity_code IS NULL
)
UPDATE public.opportunities op
SET opportunity_code = 'OPO-' || lpad(o.rn::text, 6, '0')
FROM ordered o WHERE o.id = op.id;

-- Vincular clientes já convertidos ao lead de origem
UPDATE public.customers c
SET lead_id = l.id
FROM public.leads l
WHERE l.converted_customer_id = c.id AND c.lead_id IS NULL;

-- Ajustar as sequências para continuar após o backfill
SELECT setval('public.lead_code_seq', GREATEST((SELECT count(*) FROM public.leads), 1));
SELECT setval('public.customer_code_seq', GREATEST((SELECT count(*) FROM public.customers), 1));
SELECT setval('public.opportunity_code_seq', GREATEST((SELECT count(*) FROM public.opportunities), 1));

-- Unicidade e obrigatoriedade
ALTER TABLE public.leads ALTER COLUMN lead_code SET NOT NULL;
ALTER TABLE public.customers ALTER COLUMN customer_code SET NOT NULL;
ALTER TABLE public.opportunities ALTER COLUMN opportunity_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS leads_lead_code_key ON public.leads (lead_code);
CREATE UNIQUE INDEX IF NOT EXISTS customers_customer_code_key ON public.customers (customer_code);
CREATE UNIQUE INDEX IF NOT EXISTS opportunities_opportunity_code_key ON public.opportunities (opportunity_code);
CREATE INDEX IF NOT EXISTS customers_lead_id_idx ON public.customers (lead_id);
CREATE INDEX IF NOT EXISTS opportunities_lead_id_idx ON public.opportunities (lead_id);

GRANT USAGE, SELECT ON SEQUENCE public.lead_code_seq TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.customer_code_seq TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.opportunity_code_seq TO authenticated, service_role;