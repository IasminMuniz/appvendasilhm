-- Embalagem passou a ser opcional: vendas antigas receberam o custo automaticamente,
-- sem a dona marcar. Zera a embalagem e recalcula o lucro dessas vendas.
UPDATE public.orders
SET profit = profit + packaging_cost,
    margin_percent = CASE WHEN total > 0 THEN round(((profit + packaging_cost) / total) * 100, 2) ELSE 0 END,
    packaging_cost = 0
WHERE created_at < '2026-11-22T22:20:00Z' AND packaging_cost > 0;
