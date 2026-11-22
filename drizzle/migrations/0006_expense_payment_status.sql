-- Despesas: situação do pagamento (Pendente / Pago) e data do pagamento
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Pendente',
  ADD COLUMN IF NOT EXISTS paid_at date;
