ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supervisor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gerente';

ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'criado';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'aguardando_aprovacao';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'aprovado';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'processamento';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'faturado';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'finalizado';