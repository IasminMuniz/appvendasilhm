-- ENUM additions (values usable only in later migrations/statements outside this tx are fine since we don't reference them here)
ALTER TYPE lead_stage ADD VALUE IF NOT EXISTS 'reuniao' AFTER 'qualificado';
ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'enviado';
ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'recusado';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'novo';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'entregue';

-- CUSTOMERS
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'prospect',
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

-- LEADS
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

-- PRODUCTS
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS margin_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 0;

-- INTERACTIONS: allow lead-linked entries
ALTER TABLE public.customer_interactions
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE;
ALTER TABLE public.customer_interactions ALTER COLUMN customer_id DROP NOT NULL;

-- PRODUCT PRICE HISTORY
CREATE TABLE IF NOT EXISTS public.product_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  old_price numeric NOT NULL,
  new_price numeric NOT NULL,
  changed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.product_price_history TO authenticated;
GRANT ALL ON public.product_price_history TO service_role;
ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price history readable by authenticated"
  ON public.product_price_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "price history insert by authenticated"
  ON public.product_price_history FOR INSERT TO authenticated WITH CHECK (changed_by = auth.uid());

-- OPPORTUNITIES
CREATE TABLE IF NOT EXISTS public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_description text,
  amount numeric NOT NULL DEFAULT 0,
  owner_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'aberta',
  probability integer NOT NULL DEFAULT 10,
  expected_close_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunities TO authenticated;
GRANT ALL ON public.opportunities TO service_role;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "opportunities select" ON public.opportunities
  FOR SELECT TO authenticated USING (public.can_access(auth.uid(), owner_id));
CREATE POLICY "opportunities insert" ON public.opportunities
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() OR public.is_leader(auth.uid()));
CREATE POLICY "opportunities update" ON public.opportunities
  FOR UPDATE TO authenticated USING (public.can_access(auth.uid(), owner_id));
CREATE POLICY "opportunities delete" ON public.opportunities
  FOR DELETE TO authenticated USING (owner_id = auth.uid() OR public.is_leader(auth.uid()));
CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- COMMERCIAL EVENTS (automation feed)
CREATE TABLE IF NOT EXISTS public.commercial_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  delivered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.commercial_events TO authenticated;
GRANT ALL ON public.commercial_events TO service_role;
ALTER TABLE public.commercial_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events select" ON public.commercial_events
  FOR SELECT TO authenticated USING (public.can_access(auth.uid(), created_by));
CREATE POLICY "events insert" ON public.commercial_events
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());