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
