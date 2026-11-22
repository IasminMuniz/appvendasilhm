# Cadastro de produtos para loja de roupas

## O que muda
Hoje o formulário de Produtos ainda tem campos de "integração" (Sistema, Status da conexão, Registros sincronizados). Ele passa a ser um cadastro de roupa:

- Nome do produto, Preço de venda (R$), Custo (R$), Estoque, Observações, Ativo
- Fornecedor (lista; por enquanto só "PML Fashion" = F01)
- Estilo: Mini/Curto (MI), Midi (MD), Longo (LG), Camadas/Babados (CM), Tubinho (TB), Chemise (CH), Envelope (EV), Tomara que caia (TQ), Ombro a ombro (OB)
- Cor: Branco (BR), Off-white (OF), Preto (PT), Bege (BG), Rosa (RS), Lilás (LL), Azul (AZ), Verde (VD), Vermelho (VM), Amarelo (AM), Marrom (MR), Multicolor (MC)
- Padrão: Liso (L), Estampado (E), Bordado (B)
- Tamanho: Único, PP, P, M, G, GG, XG, G1, G2, G3, 34, 36, 38, 40, 42, 44, 46, 48
- Modelo nº

## SKU automático
Montado ao vivo enquanto você preenche, sem edição manual:
`VE-[fornecedor]-[estilo]-[cor]-[padrão][modelo com 2 dígitos]-[tamanho]`
Ex.: PML Fashion, Camadas, Branco, Bordado, modelo 1, Único -> **VE-F01-CM-BR-B01-U**.
Tamanho "Único" vira **U**; os demais entram como estão (P, GG, 38...).

## Margem
Calculada automaticamente: (preço − custo) ÷ preço × 100, mostrada no formulário e salva no produto. A lista de produtos passa a mostrar SKU, preço, custo e margem.

## Premissas (ajusto se discordar)
- Novos fornecedores serão adicionados depois à lista fixa (sem tela de cadastro de fornecedores agora).
- Margem sobre o preço de venda (não markup sobre o custo).

## Detalhes técnicos
- Migration aditiva em `products`: `supplier`, `style`, `color`, `pattern`, `size`, `model_number int`, `cost numeric default 0` (todas opcionais). Sem mudança de RLS.
- `src/lib/clothing.ts`: listas de códigos + `buildSku()` e `calcMargin()`, com teste vitest cobrindo o exemplo VE-F01-CM-BR-B01-U e a fórmula de margem.
- `products.functions.ts`: aceitar os novos campos; SKU e margem recalculados no servidor.
- Reescrever formulários `produtos.novo.tsx` e `produtos.$id.tsx` e colunas de `produtos.index.tsx`; regenerar tipos.
