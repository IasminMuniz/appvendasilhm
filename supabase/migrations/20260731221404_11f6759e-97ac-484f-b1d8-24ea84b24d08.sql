-- 1. Customers: segmentation fields
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS segment text,
  ADD COLUMN IF NOT EXISTS company_size text,
  ADD COLUMN IF NOT EXISTS region text;

-- 2. Leads: loss reason + forecast
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS loss_reason text,
  ADD COLUMN IF NOT EXISTS loss_detail text,
  ADD COLUMN IF NOT EXISTS expected_close_date date;

-- 3. Customer contacts
CREATE TABLE public.customer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  email text,
  phone text,
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_contacts TO authenticated;
GRANT ALL ON public.customer_contacts TO service_role;
ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contatos visiveis conforme hierarquia" ON public.customer_contacts
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id
    AND public.can_access(auth.uid(), COALESCE(c.owner_id, c.seller_id))));

CREATE POLICY "contatos gerenciaveis conforme hierarquia" ON public.customer_contacts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id
    AND public.can_access(auth.uid(), COALESCE(c.owner_id, c.seller_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id
    AND public.can_access(auth.uid(), COALESCE(c.owner_id, c.seller_id))));

CREATE TRIGGER update_customer_contacts_updated_at
  BEFORE UPDATE ON public.customer_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Customer next actions
CREATE TABLE public.customer_next_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_date date,
  assigned_to uuid NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  created_by uuid NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_next_actions TO authenticated;
GRANT ALL ON public.customer_next_actions TO service_role;
ALTER TABLE public.customer_next_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acoes visiveis conforme hierarquia" ON public.customer_next_actions
  FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), assigned_to)
    OR EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id
      AND public.can_access(auth.uid(), COALESCE(c.owner_id, c.seller_id))));

CREATE POLICY "acoes gerenciaveis conforme hierarquia" ON public.customer_next_actions
  FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), assigned_to)
    OR EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id
      AND public.can_access(auth.uid(), COALESCE(c.owner_id, c.seller_id))))
  WITH CHECK (public.can_access(auth.uid(), assigned_to)
    OR EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id
      AND public.can_access(auth.uid(), COALESCE(c.owner_id, c.seller_id))));

CREATE TRIGGER update_customer_next_actions_updated_at
  BEFORE UPDATE ON public.customer_next_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Commercial alerts
CREATE TABLE public.commercial_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  message text NOT NULL,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_alerts TO authenticated;
GRANT ALL ON public.commercial_alerts TO service_role;
ALTER TABLE public.commercial_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alertas visiveis conforme hierarquia" ON public.commercial_alerts
  FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), user_id));

CREATE POLICY "alertas atualizaveis pelo destinatario" ON public.commercial_alerts
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "alertas inseriveis pelo proprio contexto" ON public.commercial_alerts
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), user_id));

CREATE INDEX idx_commercial_alerts_user ON public.commercial_alerts(user_id, read_at);
CREATE INDEX idx_customer_contacts_customer ON public.customer_contacts(customer_id);
CREATE INDEX idx_customer_next_actions_customer ON public.customer_next_actions(customer_id);
CREATE INDEX idx_customer_next_actions_assigned ON public.customer_next_actions(assigned_to, status);
