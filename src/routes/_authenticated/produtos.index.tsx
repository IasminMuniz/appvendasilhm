import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { ImageIcon, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listPrimaryImages, listProducts } from "@/lib/products.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { OptionsMenu, bulkDeleteToastMessage, useBulkSelection } from "@/components/bulk-select";
import { bulkDeleteProducts } from "@/lib/bulk-delete.functions";
import { RecordSearch, useRecordSearch } from "@/components/record-search";
import { formatCurrency } from "@/lib/commercial-constants";

const integrationsQueryOptions = () =>
  queryOptions({
    queryKey: ["products"],
    queryFn: () => listProducts(),
  });

export const Route = createFileRoute("/_authenticated/produtos/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(integrationsQueryOptions()),
  component: IntegrationsPage,
  errorComponent: ({ error }) => (
    <p role="alert" className="text-sm text-destructive">
      {(error as Error).message}
    </p>
  ),
  notFoundComponent: () => <p>Nenhum produto encontrado.</p>,
  head: () => ({
    meta: [
      { title: "Produtos - Nexus 360" },
      {
        name: "description",
        content:
          "Peças da loja com SKU, custo, preço e margem.",
      },
      { property: "og:title", content: "Produtos - Nexus 360" },
      {
        property: "og:description",
        content: "Catálogo de peças da loja com SKU automático.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function IntegrationsPage() {
  const { data: integrations } = useSuspenseQuery(integrationsQueryOptions());
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: photos } = useQuery({ queryKey: ["product-primary-images"], queryFn: () => listPrimaryImages() });
  const search = useRecordSearch(integrations, (i) => [i.name, i.sku, i.supplier, i.style, i.color]);
  const visible = search.results;
  const selection = useBulkSelection(visible.map((i) => i.id));

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
          <p className="text-muted-foreground">
            Peças da loja com SKU, custo, preço e margem.
          </p>
        </div>
        <Button asChild>
          <Link to="/produtos/novo">
            <Plus className="mr-2 h-4 w-4" />
            Novo produto
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Catálogo</CardTitle>
            <OptionsMenu
              total={visible.length}
              count={selection.selected.length}
              onSelectAll={selection.selectAll}
              onClearAll={selection.clear}
              onEdit={handleEdit}
              onDelete={() => removeMany.mutate({ data: { ids: selection.selected } })}
              isPending={removeMany.isPending}
              entityLabel="produto(s)"
              description="Os produtos selecionados serão removidos permanentemente."
            />
          </div>
          <RecordSearch
            query={search.query}
            onQueryChange={search.setQuery}
            suggestions={visible.map((i) => ({
              id: i.id,
              label: i.name,
              sublabel: [i.sku, i.color, i.size]
                .filter(Boolean)
                .join(" · "),
            }))}
            onSelect={(id) => navigate({ to: "/produtos/$id", params: { id } })}
          />
        </CardHeader>
        <CardContent>
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {search.isSearching
                ? "Nenhum resultado para a pesquisa."
                : "Nenhum produto cadastrado."}
            </p>
          ) : (
            <div className="divide-y">
              {visible.map((integration) => (
                <div key={integration.id} className="flex items-center justify-between gap-3 py-3">
                  <Checkbox
                    checked={selection.isSelected(integration.id)}
                    onCheckedChange={() => selection.toggle(integration.id)}
                    aria-label={`Selecionar ${integration.name}`}
                  />
                  <div className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted">
                    {photos?.[integration.id] ? (
                      <img src={photos[integration.id]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <button
                    type="button"
                    className="flex-1 text-left hover:opacity-80"
                    onClick={() =>
                      navigate({ to: "/produtos/$id", params: { id: integration.id } })
                    }
                  >
                    <p className="font-medium">{integration.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{integration.sku ?? "Sem SKU"}</p>
                    <p className="text-sm text-muted-foreground">
                      {[integration.style, integration.color, integration.pattern, integration.size && `Tam. ${integration.size}`, `${Number(integration.stock ?? 0)} em estoque`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-sm">
                      <p className="font-medium">{formatCurrency(Number(integration.price ?? 0))}</p>
                      <p className="text-muted-foreground">
                        Custo {formatCurrency(Number(integration.cost ?? 0))} · Margem {Number(integration.margin_percent ?? 0).toLocaleString("pt-BR")}%
                      </p>
                    </div>
                    <Badge variant={integration.active ? "default" : "secondary"}>
                      {integration.active ? "Ativo" : "Inativo"}
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
