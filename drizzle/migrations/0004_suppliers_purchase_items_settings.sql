-- Fornecedores
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE,
  address text,
  phone text,
  instagram text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers read" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "suppliers insert" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "suppliers update" ON public.suppliers FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR created_by IS NULL OR public.is_admin(auth.uid()));
CREATE POLICY "suppliers delete" ON public.suppliers FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR created_by IS NULL OR public.is_admin(auth.uid()));
CREATE TRIGGER suppliers_updated BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.suppliers (code, name, address)
VALUES ('F01', 'PML Fashion', 'Rua Teles, 184 - Pari, São Paulo/SP - CEP 03031-000 (Shopping Vautier Premium)')
ON CONFLICT DO NOTHING;

-- Compras: status, frete, pagamento e controle de estoque
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Pedido',
  ADD COLUMN IF NOT EXISTS freight numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS stock_added boolean NOT NULL DEFAULT false;

-- Itens de cada compra (produto opcional: kits de embalagem podem não ser produtos)
CREATE TABLE IF NOT EXISTS public.purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_items TO authenticated;
GRANT ALL ON public.purchase_items TO service_role;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase items read" ON public.purchase_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "purchase items write" ON public.purchase_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchases p WHERE p.id = purchase_id AND (p.created_by = auth.uid() OR public.is_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.purchases p WHERE p.id = purchase_id AND (p.created_by = auth.uid() OR public.is_admin(auth.uid()))));

-- Configurações da loja (ex.: custo de embalagem por peça)
CREATE TABLE IF NOT EXISTS public.store_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.store_settings TO authenticated;
GRANT ALL ON public.store_settings TO service_role;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store settings read" ON public.store_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "store settings insert" ON public.store_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "store settings update" ON public.store_settings FOR UPDATE TO authenticated USING (true);

INSERT INTO public.store_settings (key, value) VALUES ('packaging_cost', '1.84'::jsonb)
ON CONFLICT (key) DO NOTHING;
