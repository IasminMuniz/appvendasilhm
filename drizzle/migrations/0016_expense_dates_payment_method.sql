-- Despesas: data da compra separada do vencimento (ex.: compra no cartão, paga na fatura)
-- e forma de pagamento.
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS purchase_date date,
  ADD COLUMN IF NOT EXISTS payment_method text;
UPDATE public.expenses SET purchase_date = expense_date WHERE purchase_date IS NULL;