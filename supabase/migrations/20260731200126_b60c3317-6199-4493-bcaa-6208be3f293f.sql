-- ============ FUNÇÕES DE HIERARQUIA ============
CREATE OR REPLACE FUNCTION public.role_has(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  supervisor_id uuid,
  manager_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_leader(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.role_has(_user_id, 'admin') OR public.role_has(_user_id, 'gerente')
$$;

CREATE OR REPLACE FUNCTION public.supervises(_viewer uuid, _target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    WHERE tm.user_id = _target
      AND (t.supervisor_id = _viewer OR t.manager_id = _viewer)
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access(_viewer uuid, _target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _viewer = _target OR public.is_leader(_viewer) OR public.supervises(_viewer, _target)
$$;

CREATE POLICY "teams readable" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "teams admin manage" ON public.teams FOR ALL TO authenticated
  USING (public.is_leader(auth.uid())) WITH CHECK (public.is_leader(auth.uid()));
CREATE POLICY "team members readable" ON public.team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "team members admin manage" ON public.team_members FOR ALL TO authenticated
  USING (public.is_leader(auth.uid())) WITH CHECK (public.is_leader(auth.uid()));

-- ============ CLIENTES ============
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS document text;
UPDATE public.customers SET owner_id = seller_id WHERE owner_id IS NULL;

DROP POLICY IF EXISTS "Sellers can manage own customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can manage all customers" ON public.customers;
CREATE POLICY "customers readable by authenticated" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "customers insert by authenticated" ON public.customers FOR INSERT TO authenticated WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "customers update by owner or leader" ON public.customers FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), COALESCE(owner_id, seller_id)))
  WITH CHECK (public.can_access(auth.uid(), COALESCE(owner_id, seller_id)));
CREATE POLICY "customers delete by leader" ON public.customers FOR DELETE TO authenticated
  USING (public.is_leader(auth.uid()));

CREATE TABLE IF NOT EXISTS public.customer_owner_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  previous_owner_id uuid,
  new_owner_id uuid,
  changed_by uuid NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.customer_owner_history TO authenticated;
GRANT ALL ON public.customer_owner_history TO service_role;
ALTER TABLE public.customer_owner_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner history readable" ON public.customer_owner_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner history insert" ON public.customer_owner_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = changed_by);

CREATE TABLE IF NOT EXISTS public.customer_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'nota',
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_interactions TO authenticated;
GRANT ALL ON public.customer_interactions TO service_role;
ALTER TABLE public.customer_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "interactions readable" ON public.customer_interactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "interactions insert" ON public.customer_interactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "interactions update own" ON public.customer_interactions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "interactions delete own or leader" ON public.customer_interactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_leader(auth.uid()));

-- ============ LEADS ============
DO $$ BEGIN
  CREATE TYPE public.lead_stage AS ENUM (
    'novo','contato_realizado','qualificado','oportunidade',
    'proposta_enviada','negociacao','ganho','perdido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text,
  email text,
  phone text,
  city text,
  state text,
  source text,
  stage public.lead_stage NOT NULL DEFAULT 'novo',
  owner_id uuid NOT NULL,
  estimated_value numeric NOT NULL DEFAULT 0,
  probability integer NOT NULL DEFAULT 0,
  next_action text,
  next_action_date date,
  notes text,
  converted_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads select" ON public.leads FOR SELECT TO authenticated USING (public.can_access(auth.uid(), owner_id));
CREATE POLICY "leads insert" ON public.leads FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id OR public.is_leader(auth.uid()));
CREATE POLICY "leads update" ON public.leads FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), owner_id)) WITH CHECK (public.can_access(auth.uid(), owner_id));
CREATE POLICY "leads delete" ON public.leads FOR DELETE TO authenticated USING (public.can_access(auth.uid(), owner_id));

CREATE TABLE IF NOT EXISTS public.lead_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  from_stage public.lead_stage,
  to_stage public.lead_stage NOT NULL,
  changed_by uuid NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.lead_stage_history TO authenticated;
GRANT ALL ON public.lead_stage_history TO service_role;
ALTER TABLE public.lead_stage_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lead history select" ON public.lead_stage_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND public.can_access(auth.uid(), l.owner_id)));
CREATE POLICY "lead history insert" ON public.lead_stage_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = changed_by);

-- ============ PRODUTOS ============
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS commercial_description text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS technical_description text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS purpose text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS benefits text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS applications text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS dimensions text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS weight text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS specifications jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url text NOT NULL,
  caption text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.product_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT ALL ON public.product_images TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_documents TO authenticated;
GRANT ALL ON public.product_documents TO service_role;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product images readable" ON public.product_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "product images admin" ON public.product_images FOR ALL TO authenticated
  USING (public.role_has(auth.uid(),'admin')) WITH CHECK (public.role_has(auth.uid(),'admin'));
CREATE POLICY "product docs readable" ON public.product_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "product docs admin" ON public.product_documents FOR ALL TO authenticated
  USING (public.role_has(auth.uid(),'admin')) WITH CHECK (public.role_has(auth.uid(),'admin'));

-- ============ ORÇAMENTOS ============
DO $$ BEGIN
  CREATE TYPE public.quote_status AS ENUM ('rascunho','aguardando_aprovacao','aprovado','reprovado','convertido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number serial,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  seller_id uuid NOT NULL,
  status public.quote_status NOT NULL DEFAULT 'rascunho',
  subtotal numeric NOT NULL DEFAULT 0,
  discount_percent numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  notes text,
  commercial_terms text,
  valid_until date,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity integer NOT NULL,
  unit_price numeric NOT NULL,
  discount_percent numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.quote_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  approver_id uuid,
  required_role public.app_role NOT NULL,
  discount_percent numeric NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  note text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.quote_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  sent_by uuid NOT NULL,
  to_email text NOT NULL,
  subject text,
  message text,
  status text NOT NULL DEFAULT 'enviado',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.quotes_number_seq TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_items TO authenticated;
GRANT ALL ON public.quote_items TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.quote_approvals TO authenticated;
GRANT ALL ON public.quote_approvals TO service_role;
GRANT SELECT, INSERT ON public.quote_sends TO authenticated;
GRANT ALL ON public.quote_sends TO service_role;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotes select" ON public.quotes FOR SELECT TO authenticated USING (public.can_access(auth.uid(), seller_id));
CREATE POLICY "quotes insert" ON public.quotes FOR INSERT TO authenticated WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "quotes update" ON public.quotes FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), seller_id)) WITH CHECK (public.can_access(auth.uid(), seller_id));
CREATE POLICY "quotes delete" ON public.quotes FOR DELETE TO authenticated USING (public.can_access(auth.uid(), seller_id));

CREATE POLICY "quote items all" ON public.quote_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND public.can_access(auth.uid(), q.seller_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND public.can_access(auth.uid(), q.seller_id)));

CREATE POLICY "quote approvals select" ON public.quote_approvals FOR SELECT TO authenticated
  USING (auth.uid() = requested_by OR public.is_leader(auth.uid()) OR public.role_has(auth.uid(),'supervisor'));
CREATE POLICY "quote approvals insert" ON public.quote_approvals FOR INSERT TO authenticated WITH CHECK (auth.uid() = requested_by);
CREATE POLICY "quote approvals decide" ON public.quote_approvals FOR UPDATE TO authenticated
  USING (public.is_leader(auth.uid()) OR public.role_has(auth.uid(),'supervisor'))
  WITH CHECK (public.is_leader(auth.uid()) OR public.role_has(auth.uid(),'supervisor'));

CREATE POLICY "quote sends select" ON public.quote_sends FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND public.can_access(auth.uid(), q.seller_id)));
CREATE POLICY "quote sends insert" ON public.quote_sends FOR INSERT TO authenticated WITH CHECK (auth.uid() = sent_by);

-- ============ POLÍTICA DE DESCONTO ============
CREATE TABLE IF NOT EXISTS public.discount_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL UNIQUE,
  max_discount_percent numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.discount_policies TO authenticated;
GRANT ALL ON public.discount_policies TO service_role;
ALTER TABLE public.discount_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "discount policies readable" ON public.discount_policies FOR SELECT TO authenticated USING (true);
CREATE POLICY "discount policies admin" ON public.discount_policies FOR ALL TO authenticated
  USING (public.role_has(auth.uid(),'admin')) WITH CHECK (public.role_has(auth.uid(),'admin'));

INSERT INTO public.discount_policies (role, max_discount_percent) VALUES
  ('vendedor', 5), ('supervisor', 12), ('gerente', 25), ('admin', 100)
ON CONFLICT (role) DO NOTHING;

-- ============ PEDIDOS ============
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_status public.order_status,
  to_status public.order_status NOT NULL,
  changed_by uuid NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.order_status_history TO authenticated;
GRANT ALL ON public.order_status_history TO service_role;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order history select" ON public.order_status_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND public.can_access(auth.uid(), o.seller_id)));
CREATE POLICY "order history insert" ON public.order_status_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = changed_by);

DROP POLICY IF EXISTS "Sellers can manage own orders" ON public.orders;
CREATE POLICY "orders hierarchy select" ON public.orders FOR SELECT TO authenticated USING (public.can_access(auth.uid(), seller_id));
CREATE POLICY "orders insert" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "orders update" ON public.orders FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), seller_id)) WITH CHECK (public.can_access(auth.uid(), seller_id));
CREATE POLICY "orders delete" ON public.orders FOR DELETE TO authenticated USING (public.can_access(auth.uid(), seller_id));

DROP POLICY IF EXISTS "Sellers can manage own order items" ON public.order_items;
CREATE POLICY "order items hierarchy" ON public.order_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND public.can_access(auth.uid(), o.seller_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND public.can_access(auth.uid(), o.seller_id)));

-- ============ METAS ============
CREATE TABLE IF NOT EXISTS public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  target_amount numeric NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goals select" ON public.goals FOR SELECT TO authenticated
  USING (user_id IS NULL OR public.can_access(auth.uid(), user_id));
CREATE POLICY "goals manage" ON public.goals FOR ALL TO authenticated
  USING (public.is_leader(auth.uid()) OR public.role_has(auth.uid(),'supervisor'))
  WITH CHECK (public.is_leader(auth.uid()) OR public.role_has(auth.uid(),'supervisor'));

-- ============ INTEGRAÇÕES ============
CREATE TABLE IF NOT EXISTS public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,
  category text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'nao_configurado',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integrations readable" ON public.integrations FOR SELECT TO authenticated USING (true);
CREATE POLICY "integrations admin" ON public.integrations FOR ALL TO authenticated
  USING (public.role_has(auth.uid(),'admin')) WITH CHECK (public.role_has(auth.uid(),'admin'));

-- ============ EXPORTAÇÕES ============
CREATE TABLE IF NOT EXISTS public.export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  dataset text NOT NULL,
  format text NOT NULL,
  file_name text NOT NULL,
  row_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.export_jobs TO authenticated;
GRANT ALL ON public.export_jobs TO service_role;
ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "export jobs select" ON public.export_jobs FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), user_id));
CREATE POLICY "export jobs insert" ON public.export_jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============ TRIGGERS updated_at ============
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_quotes_updated BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_goals_updated BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_teams_updated BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_integrations_updated BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();