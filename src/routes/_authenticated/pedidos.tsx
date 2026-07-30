import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listOrders } from "@/lib/orders.functions";

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pendente: "secondary",
  em_andamento: "default",
  concluido: "outline",
  cancelado: "destructive",
};

const ordersQueryOptions = () =>
  queryOptions({
    queryKey: ["orders"],
    queryFn: () => listOrders(),
  });

export const Route = createFileRoute("/_authenticated/pedidos")({
  loader: ({ context }) => context.queryClient.ensureQueryData(ordersQueryOptions()),
  component: OrdersPage,
  head: () => ({
    meta: [{ title: "Pedidos - Vendas Comercial" }],
  }),
});

function OrdersPage() {
  const { data: orders } = useSuspenseQuery(ordersQueryOptions());

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
        <CardHeader>
          <CardTitle>Lista de pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido registrado.</p>
          ) : (
            <div className="divide-y">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  to="/pedidos/$id"
                  params={{ id: order.id }}
                  className="flex items-center justify-between py-3 hover:bg-accent/50"
                >
                  <div>
                    <p className="font-medium">{order.customers?.name ?? "Cliente"}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(order.created_at ?? "").toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={statusVariants[order.status ?? "pendente"]}>
                      {statusLabels[order.status ?? "pendente"]}
                    </Badge>
                    <span className="font-semibold">R$ {(order.total ?? 0).toFixed(2)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
