# Dashboard da loja

## Antes do Dashboard: Compras e Despesas de verdade
Hoje Compras e Despesas são só telas "Em breve", então não há dados de compras nem despesas para mostrar. Para os números funcionarem, essas duas telas viram cadastros simples:

- **Compras**: data, fornecedor (lista atual, ex.: PML Fashion), descrição, valor total (R$), observações.
- **Despesas**: data, descrição, categoria (Aluguel, Internet, Energia, Embalagens, Marketing, Pró-labore, Outro), valor (R$), e uma marcação **Despesa fixa** (sim/não).

Cada uma com lista, botão de nova, edição e exclusão.

## Novo Dashboard (mês atual, com seletor de mês)
Cartões no topo:
- **Faturamento do mês**: soma das vendas Pagas e Entregues
- **Lucro do mês**: soma do lucro dessas vendas
- **Peças vendidas**: soma das quantidades dessas vendas
- **Peças em estoque**: soma do estoque dos produtos ativos
- **Total investido em compras**: compras do mês (e total geral abaixo, em menor)
- **Despesas do mês**: todas as despesas do mês (fixas em destaque)
- **Falta vender para cobrir as despesas fixas**:
  - lucro que ainda falta = despesas fixas do mês − lucro do mês (zero se já cobriu, com aviso "Despesas cobertas")
  - convertido em faturamento usando a margem média do mês: falta lucro ÷ margem média
  - barra de progresso do quanto já foi coberto

Gráficos:
- **Vendas por canal** (Shopee, Facebook, Instagram, WhatsApp Business): faturamento e nº de vendas
- **Lucro por canal**

Os gráficos e números antigos de funil comercial, leads e metas saem do Dashboard (o código fica guardado).

## Detalhes técnicos
- Migration: tabelas `purchases` (purchase_date, supplier, description, amount, notes, created_by) e `expenses` (expense_date, description, category, amount, is_fixed, created_by), com GRANT para authenticated/service_role, RLS para usuários autenticados (admin edita/exclui).
- `purchases.functions.ts` / `expenses.functions.ts` (listar, criar, editar, excluir) e telas `compras.tsx` / `despesas.tsx` substituindo os placeholders.
- `store-dashboard.functions.ts`: um servidor agrega o mês (vendas pago/entregue, itens, produtos, compras, despesas).
- `src/lib/store-metrics.ts` com o cálculo do "falta vender" + teste vitest.
- `dashboard.tsx` reescrito com cartões + gráficos (recharts já usado no projeto).
