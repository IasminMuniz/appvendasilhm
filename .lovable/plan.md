# Vendas: canal, pagamento, entrega, taxas e lucro

## O que muda
- Menu, títulos e botões: "Pedidos" vira **Vendas** em todas as telas.
- Novos campos em cada venda:
  - **Canal**: Shopee, Facebook, Instagram, WhatsApp Business
  - **Forma de pagamento**: Pix, Cartão
  - **Entrega**: Shopee, Correios/plataforma de frete, Estação do metrô, Retirada
  - **Outros custos (R$)** + **Tipo de custo**: Shopee Ads, Ads Fácil, Impulsionamento Facebook/Instagram/Marketplace, Taxa de cartão, Frete/entrega, Outro

## Cálculos automáticos (mostrados no formulário, no detalhe e na lista)
- **Taxa do canal** (sobre o valor da venda), só para Shopee:
  - abaixo de R$ 80: 20% + R$ 4,50
  - R$ 80 a 99,99: 14% + R$ 16
  - R$ 100 a 199,99: 14% + R$ 20
  - R$ 200 a 499,99: 14% + R$ 26
  - R$ 500 ou mais: 14% + R$ 26 (a confirmar com você)
  - outros canais: R$ 0
- **Custo dos produtos**: soma de custo × quantidade dos itens.
- **Lucro** = valor − taxa do canal − outros custos − custo dos produtos − R$ 1,84 de embalagem.
- **Margem** = lucro ÷ valor da venda.

## Status
Apenas: Novo, Reservado, Pago, Entregue, Cancelado. Vendas antigas com outros status passam a ser mostradas no equivalente mais próximo (ex.: concluído/finalizado/faturado -> Pago ou Entregue; pendente/criado -> Novo).

## Baixa de estoque
Ao marcar uma venda como **Pago**, o estoque de cada produto é reduzido pela quantidade vendida, uma única vez (se voltar e marcar Pago de novo, não desconta em dobro). Se a venda paga for cancelada, o estoque é devolvido.

## Detalhes técnicos
- Migration aditiva: valores `reservado`, `pago` no enum `order_status`; em `orders`: `channel`, `payment_method`, `delivery_method`, `other_costs numeric default 0`, `other_cost_type`, `channel_fee`, `product_cost`, `packaging_cost default 1.84`, `profit`, `margin_percent`, `stock_deducted boolean default false`. Backfill mapeando status antigos.
- `src/lib/sales.ts`: `shopeeFee()`, `calcSale()` + teste vitest com as faixas e a fórmula de lucro.
- `orders.functions.ts`: aceitar campos, recalcular no servidor ao criar/editar; em mudança para `pago` decrementa `products.stock` e marca `stock_deducted`; cancelamento devolve.
- `commercial-constants.ts`: novos rótulos de status; telas `pedidos.*` e sidebar atualizadas.
