# Menu lateral para loja de roupas

## O que muda
Menu lateral passa a mostrar, nesta ordem:
1. Dashboard
2. Clientes
3. Produtos (antes "Integrações", continua abrindo a tela de produtos)
4. Vendas (a tela atual de Pedidos, só renomeada no menu)
5. Compras
6. Despesas
7. Exportação

Ficam escondidos do menu (código, telas e dados continuam intactos e acessíveis pelo endereço direto): Leads, Oportunidades, Orçamentos, Metas, Automações, Usuários.

## Compras e Despesas
Essas telas ainda não existem. Nesta etapa crio as duas páginas com um aviso "Em breve" para o menu não levar a erro. O cadastro real (tabelas, formulários, listagens) fica para uma próxima etapa, quando você definir quais informações cada uma deve ter.

## Ajustes de texto
Nas telas de produtos, os títulos que hoje dizem "Integrações" voltam a dizer "Produtos".

## Detalhes técnicos
- `src/components/app-sidebar.tsx`: nova lista de itens; itens ocultos removidos apenas do array (rotas mantidas).
- Novas rotas `src/routes/_authenticated/compras.tsx` e `despesas.tsx` com head() próprio e conteúdo placeholder.
- `produtos.index/novo/$id.tsx` e `commercial-constants.ts`: rótulos "Integração(ões)" -> "Produto(s)".
- Sem alterações de banco, RLS ou webhooks.
