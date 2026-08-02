import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteProduct, listProducts } from "@/lib/products.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkDeleteBar, bulkDeleteToastMessage, useBulkSelection } from "@/components/bulk-select";
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

  const remove = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto excluído.");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Erro ao excluir produto."),
  });

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
          <BulkDeleteBar
            total={products.length}
            count={selection.selected.length}
            allSelected={selection.allSelected}
            onToggleAll={selection.toggleAll}
            onDelete={() => removeMany.mutate({ data: { ids: selection.selected } })}
            isPending={removeMany.isPending}
            entityLabel="produto(s)"
            description="Os produtos selecionados e seus anexos serão removidos permanentemente."
          />
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
                    <Badge
                      variant={
                        Number(product.stock ?? 0) > 0 ? "outline" : "destructive"
                      }
                    >
                      {Number(product.stock ?? 0) > 0 ? "Em estoque" : "Sem estoque"}
                    </Badge>
                    <Badge variant={product.active ? "default" : "secondary"}>
                      {product.active ? "Ativo" : "Inativo"}
                    </Badge>
                    <Button variant="ghost" size="icon" asChild aria-label="Editar produto">
                      <Link to="/produtos/$id" params={{ id: product.id }}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Excluir produto"
                          disabled={remove.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir {product.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O produto e seus anexos serão removidos permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => remove.mutate({ data: { id: product.id } })}
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
