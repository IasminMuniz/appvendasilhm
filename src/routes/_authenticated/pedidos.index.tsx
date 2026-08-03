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
import { ORDER_STATUS_LABELS, formatCurrency } from "@/lib/commercial-constants";


const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  novo: "secondary",
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
    meta: [{ title: "Pedidos - Vendas Comercial" }],
  }),
});

function OrdersPage() {
  const { data: orders } = useSuspenseQuery(ordersQueryOptions());
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const selection = useBulkSelection(orders.map((o) => o.id));

  const removeMany = useMutation({
    mutationFn: bulkDeleteOrders,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      selection.clear();
      toast.success(bulkDeleteToastMessage(result));
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Erro ao excluir pedidos."),
  });

  const handleEdit = () => {
    if (selection.selected.length === 1) {
      navigate({ to: "/pedidos/$id", params: { id: selection.selected[0]! } });
      return;
    }
    toast.info("Selecione apenas um pedido para abrir o formulário de edição.");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pedidos</h1>
          <p className="text-muted-foreground">Acompanhe todos os pedidos da equipe comercial.</p>
        </div>
        <Button asChild>
          <Link to="/pedidos/novo">
            <Plus className="mr-2 h-4 w-4" />
            Novo pedido
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle>Lista de pedidos</CardTitle>
          <OptionsMenu
            total={orders.length}
            count={selection.selected.length}
            onSelectAll={selection.selectAll}
            onClearAll={selection.clear}
            onEdit={handleEdit}
            onDelete={() => removeMany.mutate({ data: { ids: selection.selected } })}
            isPending={removeMany.isPending}
            entityLabel="pedido(s)"
            description="Os pedidos selecionados, seus itens e histórico serão removidos permanentemente."
          />
        </CardHeader>
        <CardContent>

          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido registrado.</p>
          ) : (
            <div className="divide-y">
              {orders.map((order) => (
                <div key={order.id} className="flex items-center gap-3 py-3">
                  <Checkbox
                    checked={selection.isSelected(order.id)}
                    onCheckedChange={() => selection.toggle(order.id)}
                    aria-label="Selecionar pedido"
                  />
                  <Link
                    to="/pedidos/$id"
                    params={{ id: order.id }}
                    className="flex flex-1 items-center justify-between hover:bg-accent/50"
                  >
                    <div>
                      <p className="font-medium">{order.customers?.name ?? "Cliente"}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(order.created_at ?? "").toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={statusVariants[order.status ?? "novo"] ?? "outline"}>
                        {ORDER_STATUS_LABELS[order.status ?? "novo"] ?? order.status}
                      </Badge>
                      <span className="font-semibold">
                        {formatCurrency(Number(order.total ?? 0))}
                      </span>
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
