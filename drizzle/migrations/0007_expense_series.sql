-- Despesas fixas recorrentes: liga os lançamentos mensais da mesma despesa
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS series_id uuid;
CREATE INDEX IF NOT EXISTS expenses_series_id_idx ON public.expenses (series_id);
