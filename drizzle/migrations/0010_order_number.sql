-- Número sequencial da venda (V-0001, V-0002...), gerado automaticamente
CREATE SEQUENCE IF NOT EXISTS public.orders_number_seq;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number integer;
WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY created_at) AS n
  FROM public.orders
  WHERE order_number IS NULL
)
UPDATE public.orders o
SET order_number = x.n + COALESCE((SELECT max(order_number) FROM public.orders), 0)
FROM ordered x
WHERE o.id = x.id;
SELECT setval('public.orders_number_seq', GREATEST(COALESCE((SELECT max(order_number) FROM public.orders), 0), 1), COALESCE((SELECT max(order_number) FROM public.orders), 0) > 0);
ALTER TABLE public.orders ALTER COLUMN order_number SET DEFAULT nextval('public.orders_number_seq');
ALTER SEQUENCE public.orders_number_seq OWNED BY public.orders.order_number;
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_key ON public.orders (order_number);
