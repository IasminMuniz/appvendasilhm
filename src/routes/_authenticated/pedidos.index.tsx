import { saleCode } from "@/lib/sales";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { OptionsMenu, bulkDeleteToastMessage, useBulkSelection } from "@/components/bulk-select";
import { bulkDeleteOrders } from "@/lib/bulk-delete.functions";
import { listOrders } from "@/lib/orders.functions";
import { RecordSearch, useRecordSearch } from "@/components/record-search";
import { ORDER_STATUS_LABELS, formatCurrency } from "@/lib/commercial-constants";

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  novo: "secondary",
  reservado: "secondary",
  pago: "default",
  criado: "secondary",
  aguardando_aprovacao: "secondary",
  aprovado: "default",
  processamento: "default",
  faturado: "default",
  entregue: "outline",
  finalizado: "outline",
  cancelado: "destructive",
};

const ordersQueryOptions = () =>
  queryOptions({
    queryKey: ["orders"],
    queryFn: () => listOrders(),
  });

export const Route = createFileRoute("/_authenticated/pedidos/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(ordersQueryOptions()),
  component: OrdersPage,
  head: () => ({
    meta: [
      { title: "Vendas - Nexus 360" },
      { name: "description", content: "Vendas da loja com canal, taxa, lucro e margem." },
      { property: "og:title", content: "Vendas - Nexus 360" },
      { property: "og:description", content: "Acompanhe as vendas da loja e o lucro de cada uma." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function OrdersPage() {
  const { data: orders } = useSuspenseQuery(ordersQueryOptions());
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // Número da venda: do banco (order_number) ou, até a migration, pela ordem de cadastro.
  const codes = new Map<string, string>();
  [...orders]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .forEach((o, i) => {
      codes.set(o.id, saleCode((o as { order_number?: number | null }).order_number ?? i + 1));
    });
  const code = (id: string) => codes.get(id) ?? "";
  const search = useRecordSearch(orders, (o) => [
    code(o.id),
    o.customers?.name,
    (o.customers as { company_name?: string | null } | null)?.company_name,
    (o.customers as { customer_code?: string | null } | null)?.customer_code,
    (o.customers as { document?: string | null } | null)?.document,
    o.id,
    o.channel,
    o.payment_method,
    o.delivery_method,
    o.status,
    o.notes,
    ...(o.order_items ?? []).map((i) => (i.products as { name?: string | null } | null)?.name),
  ]);
  const visibleOrders = search.results;
  const selection = useBulkSelection(visibleOrders.map((o) => o.id));

  const removeMany = useMutation({
    mutationFn: bulkDeleteOrders,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      selection.clear();
      toast.success(bulkDeleteToastMessage(result));
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao excluir vendas."),
  });

  const handleEdit = () => {
    if (selection.selected.length === 1) {
      navigate({ to: "/pedidos/$id", params: { id: selection.selected[0]! } });
      return;
    }
    toast.info("Selecione apenas uma venda para abrir o formulário de edição.");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendas</h1>
          <p className="text-muted-foreground">Todas as vendas da loja, com lucro e margem.</p>
        </div>
        <Button asChild>
          <Link to="/pedidos/novo">
            <Plus className="mr-2 h-4 w-4" />
            Nova venda
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Lista de vendas</CardTitle>
            <OptionsMenu
              total={visibleOrders.length}
              count={selection.selected.length}
              onSelectAll={selection.selectAll}
              onClearAll={selection.clear}
              onEdit={handleEdit}
              onDelete={() => removeMany.mutate({ data: { ids: selection.selected } })}
              isPending={removeMany.isPending}
              entityLabel="venda(s)"
              description="As vendas selecionadas, seus itens e histórico serão removidos permanentemente."
            />
          </div>
          <RecordSearch
            placeholder="Pesquisar por nº (V-0001), cliente, peça, canal, status..."
            query={search.query}
            onQueryChange={search.setQuery}
            suggestions={visibleOrders.map((o) => ({
              id: o.id,
              label:
                (o.customers as { company_name?: string | null } | null)?.company_name ||
                o.customers?.name ||
                "Cliente",
              sublabel: formatCurrency(Number(o.total ?? 0)),
            }))}
            onSelect={(id) => navigate({ to: "/pedidos/$id", params: { id } })}
          />
        </CardHeader>
        <CardContent>
          {visibleOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {search.isSearching
                ? "Nenhum resultado para a pesquisa."
                : "Nenhuma venda registrada."}
            </p>
          ) : (
            <div className="divide-y">
              {visibleOrders.map((order) => (
                <div key={order.id} className="flex items-center gap-3 py-3">
                  <Checkbox
                    checked={selection.isSelected(order.id)}
                    onCheckedChange={() => selection.toggle(order.id)}
                    aria-label="Selecionar venda"
                  />
                  <Link
                    to="/pedidos/$id"
                    params={{ id: order.id }}
                    className="flex flex-1 items-center justify-between hover:bg-accent/50"
                  >
                    <div>
                      <p className="font-medium">
                        <span className="mr-2 font-mono text-xs text-muted-foreground">
                          {code(order.id)}
                        </span>
                        {order.customers?.name ?? "Cliente"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {[
                          new Date(order.created_at ?? "").toLocaleDateString("pt-BR"),
                          order.channel,
                          order.payment_method,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={statusVariants[order.status ?? "novo"] ?? "outline"}>
                        {ORDER_STATUS_LABELS[order.status ?? "novo"] ?? order.status}
                      </Badge>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(Number(order.total ?? 0))}</p>
                        <p
                          className={`text-xs ${Number(order.profit ?? 0) < 0 ? "text-destructive" : "text-muted-foreground"}`}
                        >
                          Lucro {formatCurrency(Number(order.profit ?? 0))} ·{" "}
                          {Number(order.margin_percent ?? 0).toLocaleString("pt-BR")}%
                        </p>
                      </div>
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
