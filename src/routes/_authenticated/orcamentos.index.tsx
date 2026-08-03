import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { OptionsMenu, bulkDeleteToastMessage, useBulkSelection } from "@/components/bulk-select";
import { bulkDeleteQuotes } from "@/lib/bulk-delete.functions";
import { listQuotes } from "@/lib/quotes.functions";
import { RecordSearch, useRecordSearch } from "@/components/record-search";
import { QUOTE_STATUS_LABELS, formatCurrency } from "@/lib/commercial-constants";


const quotesQueryOptions = () =>
  queryOptions({ queryKey: ["quotes"], queryFn: () => listQuotes() });

export const Route = createFileRoute("/_authenticated/orcamentos/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(quotesQueryOptions()),
  component: QuotesPage,
  head: () => ({
    meta: [
      { title: "Orçamentos - Plataforma Comercial" },
      {
        name: "description",
        content: "Crie, aprove e converta orçamentos comerciais em pedidos com PDF e envio por e-mail.",
      },
    ],
  }),
});

const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  rascunho: "outline",
  aguardando_aprovacao: "secondary",
  aprovado: "default",
  reprovado: "destructive",
  convertido: "default",
};

function QuotesPage() {
  const { data: quotes } = useSuspenseQuery(quotesQueryOptions());
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const search = useRecordSearch(quotes, (q) => [
    q.customers?.name,
    q.customers?.company_name,
    (q.customers as { customer_code?: string | null } | null)?.customer_code,
    (q.customers as { document?: string | null } | null)?.document,
    `#${q.number}`,
    String(q.number),
  ]);
  const visibleQuotes = search.results;
  const selection = useBulkSelection(visibleQuotes.map((q) => q.id));

  const removeMany = useMutation({
    mutationFn: bulkDeleteQuotes,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      selection.clear();
      toast.success(bulkDeleteToastMessage(result));
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Erro ao excluir orçamentos."),
  });

  const handleEdit = () => {
    if (selection.selected.length === 1) {
      navigate({ to: "/orcamentos/$id", params: { id: selection.selected[0]! } });
      return;
    }
    toast.info("Selecione apenas um orçamento para abrir o formulário de edição.");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orçamentos</h1>
          <p className="text-muted-foreground">Propostas comerciais e aprovações de desconto.</p>
        </div>
        <Button asChild>
          <Link to="/orcamentos/novo">
            <Plus className="mr-2 h-4 w-4" />
            Novo orçamento
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Lista de orçamentos</CardTitle>
          <OptionsMenu
            total={visibleQuotes.length}
            count={selection.selected.length}
            onSelectAll={selection.selectAll}
            onClearAll={selection.clear}
            onEdit={handleEdit}
            onDelete={() => removeMany.mutate({ data: { ids: selection.selected } })}
            isPending={removeMany.isPending}
            entityLabel="orçamento(s)"
            description="Os orçamentos selecionados, seus itens e aprovações serão removidos permanentemente."
          />
          </div>
          <RecordSearch
            query={search.query}
            onQueryChange={search.setQuery}
            suggestions={visibleQuotes.map((q) => ({
              id: q.id,
              label: q.customers?.company_name || q.customers?.name || "Cliente",
              sublabel: `#${q.number} · ${formatCurrency(Number(q.total ?? 0))}`,
            }))}
            onSelect={(id) => navigate({ to: "/orcamentos/$id", params: { id } })}
          />
        </CardHeader>
        <CardContent>

          {visibleQuotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {search.isSearching ? "Nenhum resultado para a pesquisa." : "Nenhum orçamento criado."}
            </p>
          ) : (
            <div className="divide-y">
              {visibleQuotes.map((quote) => (
                <div key={quote.id} className="flex items-center gap-3 py-3">
                  <Checkbox
                    checked={selection.isSelected(quote.id)}
                    onCheckedChange={() => selection.toggle(quote.id)}
                    aria-label={`Selecionar orçamento ${quote.number}`}
                  />
                  <Link
                    to="/orcamentos/$id"
                    params={{ id: quote.id }}
                    className="flex flex-1 items-center justify-between hover:opacity-80"
                  >
                    <div>
                      <p className="font-medium">
                        #{quote.number} · {quote.customers?.company_name || quote.customers?.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(quote.created_at).toLocaleDateString("pt-BR")} · Desconto{" "}
                        {Number(quote.discount_percent ?? 0)}%
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">
                        {formatCurrency(Number(quote.total ?? 0))}
                      </span>
                      <Badge variant={variants[quote.status] ?? "outline"}>
                        {QUOTE_STATUS_LABELS[quote.status] ?? quote.status}
                      </Badge>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
