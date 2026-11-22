UPDATE public.orders SET status = CASE
  WHEN status IN ('pendente','criado','aguardando_aprovacao','em_andamento','processamento') THEN 'novo'::public.order_status
  WHEN status IN ('aprovado','faturado','concluido') THEN 'pago'::public.order_status
  WHEN status = 'finalizado' THEN 'entregue'::public.order_status
  ELSE status END
WHERE status NOT IN ('novo','reservado','pago','entregue','cancelado');