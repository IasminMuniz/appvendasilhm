CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  supplier text,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchases read" ON public.purchases FOR SELECT TO authenticated USING (true);
CREATE POLICY "purchases insert" ON public.purchases FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "purchases update" ON public.purchases FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "purchases delete" ON public.purchases FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  category text,
  amount numeric NOT NULL DEFAULT 0,
  is_fixed boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses read" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "expenses insert" ON public.expenses FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "expenses update" ON public.expenses FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "expenses delete" ON public.expenses FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER purchases_updated BEFORE UPDATE ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER expenses_updated BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();