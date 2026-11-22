import { MutationCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Qualquer alteração salva (produto, compra, venda, despesa...) atualiza todas as telas,
  // para que lucro, estoque e caixa nunca fiquem com valores antigos.
  const queryClient: QueryClient = new QueryClient({
    mutationCache: new MutationCache({
      onSuccess: () => {
        void queryClient.invalidateQueries();
      },
    }),
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
