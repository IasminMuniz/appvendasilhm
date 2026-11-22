ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS supplier text,
  ADD COLUMN IF NOT EXISTS style text,
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS pattern text,
  ADD COLUMN IF NOT EXISTS size text,
  ADD COLUMN IF NOT EXISTS model_number integer,
  ADD COLUMN IF NOT EXISTS cost numeric NOT NULL DEFAULT 0;