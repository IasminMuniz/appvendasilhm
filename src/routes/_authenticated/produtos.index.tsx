import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listProducts } from "@/lib/products.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { OptionsMenu, bulkDeleteToastMessage, useBulkSelection } from "@/components/bulk-select";
import { bulkDeleteProducts } from "@/lib/bulk-delete.functions";

const productsQueryOptions = () =>
  queryOptions({
    queryKey: ["products"],
    queryFn: () => listProducts(),
  });

export const Route = createFileRoute("/_authenticated/produtos/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(productsQueryOptions()),
  component: ProductsPage,
  errorComponent: ({ error }) => (
    <p role="alert" className="text-sm text-destructive">
      {error.message}
    </p>
  ),
  notFoundComponent: () => <p>Nenhum produto encontrado.</p>,
  head: () => ({
    meta: [{ title: "Produtos - Vendas Comercial" }],
  }),
});

function ProductsPage() {
  const { data: products } = useSuspenseQuery(productsQueryOptions());
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const selection = useBulkSelection(products.map((p) => p.id));

  const removeMany = useMutation({
    mutationFn: bulkDeleteProducts,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      selection.clear();
      toast.success(bulkDeleteToastMessage(result));
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Erro ao excluir produtos."),
  });

  const handleEdit = () => {
    if (selection.selected.length === 1) {
      navigate({ to: "/produtos/$id", params: { id: selection.selected[0]! } });
      return;
    }
    toast.info("Selecione apenas um produto para abrir o formulário de edição.");
  };

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
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle>Lista de produtos</CardTitle>
          <OptionsMenu
            total={products.length}
            count={selection.selected.length}
            onSelectAll={selection.selectAll}
            onClearAll={selection.clear}
            onEdit={handleEdit}
            onDelete={() => removeMany.mutate({ data: { ids: selection.selected } })}
            isPending={removeMany.isPending}
            entityLabel="produto(s)"
            description="Os produtos selecionados e seus anexos serão removidos permanentemente."
          />
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum produto cadastrado.</p>
          ) : (
            <div className="divide-y">
              {products.map((product) => (
                <div key={product.id} className="flex items-center justify-between gap-3 py-3">
                  <Checkbox
                    checked={selection.isSelected(product.id)}
                    onCheckedChange={() => selection.toggle(product.id)}
                    aria-label={`Selecionar ${product.name}`}
                  />
                  <button
                    type="button"
                    className="flex-1 text-left hover:opacity-80"
                    onClick={() => navigate({ to: "/produtos/$id", params: { id: product.id } })}
                  >
                    <p className="font-medium">
                      {product.name}
                      {product.code ? (
                        <span className="ml-2 text-xs text-muted-foreground">({product.code})</span>
                      ) : null}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {[
                        product.category,
                        `Margem ${Number(product.margin_percent ?? 0)}%`,
                        `Estoque ${Number(product.stock ?? 0)}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">R$ {(product.price ?? 0).toFixed(2)}</span>
                    <Badge variant={Number(product.stock ?? 0) > 0 ? "outline" : "destructive"}>
                      {Number(product.stock ?? 0) > 0 ? "Em estoque" : "Sem estoque"}
                    </Badge>
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
