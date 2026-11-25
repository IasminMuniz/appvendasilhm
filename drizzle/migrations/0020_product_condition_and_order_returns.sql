-- Condição da peça: novo (revenda) ou seminovo (peças próprias). Estado descreve o uso/defeitos.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS condition text NOT NULL DEFAULT 'novo',
  ADD COLUMN IF NOT EXISTS condition_notes text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_condition_check') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_condition_check CHECK (condition IN ('novo', 'seminovo'));
  END IF;
END $$;

-- Trocas e devoluções: a venda fica cancelada (estoque volta, sai do faturamento) e guarda o motivo.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS return_type text,
  ADD COLUMN IF NOT EXISTS return_reason text,
  ADD COLUMN IF NOT EXISTS return_notes text,
  ADD COLUMN IF NOT EXISTS returned_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_return_type_check') THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_return_type_check CHECK (return_type IS NULL OR return_type IN ('devolucao', 'troca'));
  END IF;
END $$;