ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'reservado';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'pago';
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS channel text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS delivery_method text,
  ADD COLUMN IF NOT EXISTS other_costs numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_cost_type text,
  ADD COLUMN IF NOT EXISTS channel_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS product_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS packaging_cost numeric NOT NULL DEFAULT 1.84,
  ADD COLUMN IF NOT EXISTS profit numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS margin_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_deducted boolean NOT NULL DEFAULT false;