## Objetivo

Evoluir o app atual (autenticação, Supabase, layout e componentes mantidos) para uma Plataforma Comercial Inteligente, em fases entregáveis.

## Fase 1 — Base de dados e hierarquia (fundação)

Novas estruturas no banco, sem quebrar o que existe:

- `customers`: passa a ser visível para todo vendedor autenticado; ganha `owner_id` (responsável atual), `updated_by`, e nova tabela `customer_owner_history` (responsável anterior/novo, quem alterou, quando).
- Hierarquia: enum de perfis passa a ter `admin`, `gerente`, `supervisor`, `vendedor`; tabela `teams`/`team_members` para vínculo vendedor→supervisor→gerente, usada nas políticas de acesso.
- `leads` + `lead_stage_history` (etapas do funil, responsável, valor estimado, probabilidade, próxima ação).
- `products`: campos comerciais/técnicos (descrição comercial e técnica, finalidade, benefícios, aplicações, medidas, peso, especificações em JSON) + tabelas de imagens e documentos com bucket de arquivos.
- `quotes` + `quote_items` + `quote_approvals` + `quote_sends` (orçamentos, descontos, aprovações, histórico de envio).
- `discount_policies` (limite de desconto por perfil).
- `orders`: novos status (criado, aguardando aprovação, aprovado, processamento, faturado, finalizado, cancelado) + `order_status_history`.
- `goals` (metas por vendedor/equipe/período).
- `integrations` (registro de integrações configuráveis) e `export_jobs` (histórico de exportações/backup).

RLS conforme regra pedida: clientes visíveis a todos os autenticados (edição pelo responsável ou superior), pedidos/orçamentos por vendedor + hierarquia, produtos leitura geral e escrita só admin.

## Fase 2 — Clientes e Leads

- Página de detalhe do cliente com abas: cadastro, responsável comercial (+ troca de responsável e histórico), relacionamento, pedidos, e painel analítico (última compra e valor, média mensal, ticket médio, produtos mais comprados, indicador de saúde do cliente calculado por recência/frequência/valor).
- Módulo Leads separado, com Kanban arrastável nas 8 etapas, edição de status, histórico de movimentações, responsável, valor estimado, probabilidade e próxima ação. Ação "converter em cliente".

## Fase 3 — Produtos e Orçamentos

- Cadastro expandido de produtos + ficha de produto profissional (galeria de imagens, especificações, documentos para download).
- Módulo de Orçamentos: seleção de cliente, itens com cálculo automático, desconto por item e total, observações, fluxo Rascunho → Enviado para aprovação → Aprovado/Reprovado → Convertido em pedido.
- Aprovação hierárquica de desconto: limite por perfil; ao ultrapassar, envia automaticamente ao nível superior e registra solicitante, aprovador, percentual, data e observação.

## Fase 4 — PDF e E-mail

- Botão "Gerar PDF" do orçamento (logo, dados da empresa, cliente, produtos com descrição, valores, desconto, condições comerciais).
- Botão "Enviar orçamento ao cliente": gera o PDF, anexa, permite mensagem personalizada e grava histórico de envio. Requer domínio de e-mail próprio configurado.

## Fase 5 — Pedidos, Dashboards e Metas

- Pedidos: ações Próxima etapa / Aprovar / Reprovar / Cancelar com histórico de status.
- Dashboards por perfil: Empresa (faturamento, vendas, pedidos, clientes, crescimento, backlog), Gerencial (vendas por equipe, ranking, metas), Supervisor (produtividade, pipeline, vendedores), Vendedor (carteira, oportunidades, vendas, metas).
- Metas: definição, realizado, percentual atingido, previsão e alertas (atingida / próximo / risco).

## Fase 6 — Integrações e Exportação

- Módulo "Integrações": tela de catálogo e configuração com arquitetura de conectores pronta (Salesforce, HubSpot, Pipedrive, RD Station, Apollo, Lusha, Hunter, LinkedIn Sales Navigator, ERP, SEFAZ) — cadastro, credenciais e status; ativação real de cada conector depois, uma a uma.
- Módulo "Exportação de Dados": exportar clientes, leads, produtos, pedidos e vendas em CSV, XLSX e JSON, além de "Backup Completo", com registro de usuário, data, formato e arquivo gerado.

## Notas técnicas

- Tudo em TanStack Start: server functions em `src/lib/*.functions.ts`, rotas em `src/routes/_authenticated/*`, RLS via funções `SECURITY DEFINER` para hierarquia (evita recursão em policies).
- PDF gerado no servidor; e-mail via infraestrutura nativa da plataforma (exige domínio verificado).
- Migrações incrementais, sem apagar dados nem tabelas existentes.

## Ordem de execução

Implemento fase a fase, começando pela Fase 1 (banco + RLS + hierarquia) e seguindo na ordem acima, validando cada etapa antes da próxima.