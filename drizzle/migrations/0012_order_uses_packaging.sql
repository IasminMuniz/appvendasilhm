-- Embalagem só entra na venda quando marcada. Vendas antigas tinham a embalagem automática:
-- ficam sem embalagem e o lucro é ajustado.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS uses_packaging boolean NOT NULL DEFAULT false;
UPDATE public.orders
SET profit = profit + packaging_cost,
    margin_percent = CASE WHEN total > 0 THEN round(((profit + packaging_cost) / total) * 100, 2) ELSE 0 END,
    packaging_cost = 0
WHERE uses_packaging = false AND packaging_cost > 0;
