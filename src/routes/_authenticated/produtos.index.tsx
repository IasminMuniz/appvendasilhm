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
import { RecordSearch, useRecordSearch } from "@/components/record-search";
import {
  INTEGRATION_STATUS_LABELS,
  formatDateTime,
  integrationStatusVariant,
} from "@/lib/commercial-constants";

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
      {error.message}
    </p>
  ),
  notFoundComponent: () => <p>Nenhuma integração encontrada.</p>,
  head: () => ({
    meta: [
      { title: "Integrações - Nexus 360" },
      {
        name: "description",
        content:
          "Conexões com sistemas corporativos de CRM, ERP, marketing e atendimento no Nexus 360.",
      },
      { property: "og:title", content: "Integrações - Nexus 360" },
      {
        property: "og:description",
        content: "Status de conexão e sincronização dos sistemas integrados ao Nexus 360.",
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
  const search = useRecordSearch(integrations, (i) => [i.name, i.category, i.code]);
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
      toast.error(err instanceof Error ? err.message : "Erro ao excluir integrações."),
  });

  const handleEdit = () => {
    if (selection.selected.length === 1) {
      navigate({ to: "/produtos/$id", params: { id: selection.selected[0]! } });
      return;
    }
    toast.info("Selecione apenas uma integração para abrir o formulário de edição.");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrações</h1>
          <p className="text-muted-foreground">
            Conexões com sistemas corporativos (CRM, ERP, Marketing e Atendimento).
          </p>
        </div>
        <Button asChild>
          <Link to="/produtos/novo">
            <Plus className="mr-2 h-4 w-4" />
            Nova integração
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Sistemas integrados</CardTitle>
            <OptionsMenu
              total={visible.length}
              count={selection.selected.length}
              onSelectAll={selection.selectAll}
              onClearAll={selection.clear}
              onEdit={handleEdit}
              onDelete={() => removeMany.mutate({ data: { ids: selection.selected } })}
              isPending={removeMany.isPending}
              entityLabel="integração(ões)"
              description="As integrações selecionadas serão removidas permanentemente."
            />
          </div>
          <RecordSearch
            query={search.query}
            onQueryChange={search.setQuery}
            suggestions={visible.map((i) => ({
              id: i.id,
              label: i.name,
              sublabel: [i.category, INTEGRATION_STATUS_LABELS[i.code ?? ""]]
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
                : "Nenhuma integração cadastrada."}
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
                  <button
                    type="button"
                    className="flex-1 text-left hover:opacity-80"
                    onClick={() =>
                      navigate({ to: "/produtos/$id", params: { id: integration.id } })
                    }
                  >
                    <p className="font-medium">{integration.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {[
                        integration.category,
                        `Última sincronização: ${formatDateTime(integration.updated_at)}`,
                        `${Number(integration.stock ?? 0)} registros sincronizados`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </button>
                  <div className="flex items-center gap-3">
                    <Badge variant={integrationStatusVariant(integration.code)}>
                      {INTEGRATION_STATUS_LABELS[integration.code ?? ""] ?? "Desconectado"}
                    </Badge>
                    <Badge variant={integration.active ? "default" : "secondary"}>
                      {integration.active ? "Ativa" : "Inativa"}
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
