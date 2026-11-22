-- Pagamentos da cliente por venda: parcelas, vencimento e recebimento
CREATE TABLE IF NOT EXISTS public.order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  number integer NOT NULL DEFAULT 1,
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  method text,
  status text NOT NULL DEFAULT 'Pendente',
  paid_at date,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_payments_order_id_idx ON public.order_payments (order_id);
CREATE INDEX IF NOT EXISTS order_payments_due_date_idx ON public.order_payments (due_date);

ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order payments read" ON public.order_payments;
CREATE POLICY "order payments read" ON public.order_payments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "order payments write" ON public.order_payments;
CREATE POLICY "order payments write" ON public.order_payments FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
