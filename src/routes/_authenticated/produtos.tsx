import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listProducts } from "@/lib/products.functions";

const productsQueryOptions = () =>
  queryOptions({
    queryKey: ["products"],
    queryFn: () => listProducts(),
  });

export const Route = createFileRoute("/_authenticated/produtos")({
  loader: ({ context }) => context.queryClient.ensureQueryData(productsQueryOptions()),
  component: ProductsPage,
  head: () => ({
    meta: [{ title: "Produtos - Vendas Comercial" }],
  }),
});

function ProductsPage() {
  const { data: products } = useSuspenseQuery(productsQueryOptions());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground">Catálogo de produtos disponíveis.</p>
        </div>
        <Button asChild>
          <Link to="/produtos/novo">
            <Plus className="mr-2 h-4 w-4" />
            Novo produto
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de produtos</CardTitle>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum produto cadastrado.</p>
          ) : (
            <div className="divide-y">
              {products.map((product) => (
                <div key={product.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {product.description || "Sem descrição"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">R$ {(product.price ?? 0).toFixed(2)}</span>
                    <Badge variant={product.active ? "default" : "secondary"}>
                      {product.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
