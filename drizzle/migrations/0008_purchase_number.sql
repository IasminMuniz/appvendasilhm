-- Número sequencial da compra (C-0001, C-0002...), gerado automaticamente
CREATE SEQUENCE IF NOT EXISTS public.purchases_number_seq;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS purchase_number integer;
WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY purchase_date, created_at) AS n
  FROM public.purchases
  WHERE purchase_number IS NULL
)
UPDATE public.purchases p
SET purchase_number = o.n + COALESCE((SELECT max(purchase_number) FROM public.purchases), 0)
FROM ordered o
WHERE p.id = o.id;
SELECT setval('public.purchases_number_seq', GREATEST(COALESCE((SELECT max(purchase_number) FROM public.purchases), 0), 1), COALESCE((SELECT max(purchase_number) FROM public.purchases), 0) > 0);
ALTER TABLE public.purchases ALTER COLUMN purchase_number SET DEFAULT nextval('public.purchases_number_seq');
ALTER SEQUENCE public.purchases_number_seq OWNED BY public.purchases.purchase_number;
CREATE UNIQUE INDEX IF NOT EXISTS purchases_purchase_number_key ON public.purchases (purchase_number);
