Vou construir uma base funcional de app de vendas comercial com foco no módulo de **Pedidos**, autenticação e papéis de usuário (admin e vendedor).

````text
Estrutura proposta
------------------
/auth              → login/cadastro
/dashboard         → resumo comercial (protegido)
/clientes          → cadastro de clientes
/clientes/novo     → novo cliente
/produtos          → cadastro de produtos
/produtos/novo     → novo produto
/pedidos           → lista de pedidos
/pedidos/novo      → criar pedido
/pedidos/$id       → detalhe do pedido
````

### Banco de dados
- `profiles`: perfis vinculados aos usuários do auth
- `user_roles`: papéis separados (admin, vendedor)
- `customers`: clientes (nome, email, telefone, endereço)
- `products`: produtos (nome, descrição, preço, ativo)
- `orders`: pedidos (cliente, vendedor, status, total, observações)
- `order_items`: itens de cada pedido (produto, quantidade, preço unitário)

### Regras de acesso (RLS)
- Admin: acesso total a todos os dados
- Vendedor: pode gerenciar seus próprios clientes e pedidos
- Produtos: visíveis para usuários autenticados, editáveis apenas por admin

### Funcionalidades iniciais
- Cadastro e login com email/senha
- Atribuição automática de papel `vendedor` no cadastro
- CRUD de clientes
- CRUD de produtos (admin pode criar/editar)
- Criação de pedidos vinculando cliente e produtos
- Cálculo automático de total do pedido
- Lista e detalhe de pedidos
- Dashboard com cards de resumo

### Design
- Visual profissional corporativo: tons de azul/cinza escuro
- Layout com sidebar navegável
- Tabelas, cards e formulários com shadcn/ui
- Responsivo básico

### Tecnologias
- TanStack Start + React
- Tailwind CSS v4
- shadcn/ui
- Lovable Cloud (Supabase) com RLS
- Server functions para backend

Aprovando, começo pela migração do banco e depois construo as telas e server functions.