-- Aportes: dinheiro seu colocado na loja (inicial e os seguintes)
CREATE TABLE IF NOT EXISTS public.capital_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  description text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.capital_contributions TO authenticated;
GRANT ALL ON public.capital_contributions TO service_role;
ALTER TABLE public.capital_contributions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='capital_contributions' AND policyname='contributions read') THEN
    CREATE POLICY "contributions read" ON public.capital_contributions FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='capital_contributions' AND policyname='contributions insert') THEN
    CREATE POLICY "contributions insert" ON public.capital_contributions FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='capital_contributions' AND policyname='contributions update') THEN
    CREATE POLICY "contributions update" ON public.capital_contributions FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_admin(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='capital_contributions' AND policyname='contributions delete') THEN
    CREATE POLICY "contributions delete" ON public.capital_contributions FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_admin(auth.uid()));
  END IF;
END $$;