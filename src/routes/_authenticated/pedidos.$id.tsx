import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getOrder, updateOrderStatus } from "@/lib/orders.functions";

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const statusOptions = [
  { value: "pendente", label: "Pendente" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
];

const orderQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["orders", id],
    queryFn: () => getOrder({ data: { id } }),
  });

export const Route = createFileRoute("/_authenticated/pedidos/$id")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(orderQueryOptions(params.id)),
  component: OrderDetailPage,
  head: () => ({
    meta: [{ title: "Detalhes do Pedido - Vendas Comercial" }],
  }),
});

function OrderDetailPage() {
  const { id } = useParams({ from: "/_authenticated/pedidos/$id" });
  const queryClient = useQueryClient();
  const { data: order } = useSuspenseQuery(orderQueryOptions(id));

  const mutation = useMutation({
    mutationFn: updateOrderStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders", id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" asChild>
        <Link to="/pedidos">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Link>
      </Button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pedido</h1>
          <p className="text-muted-foreground">
            {new Date(order.created_at ?? "").toLocaleDateString("pt-BR")}
          </p>
        </div>
        <Badge variant="outline">{statusLabels[order.status ?? "pendente"]}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="font-medium">{order.customers?.name ?? "Cliente"}</p>
          {order.customers?.email && <p className="text-sm text-muted-foreground">{order.customers.email}</p>}
          {order.customers?.phone && <p className="text-sm text-muted-foreground">{order.customers.phone}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Itens</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {order.order_items?.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{item.products?.name ?? "Produto"}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.quantity} x R$ {(item.unit_price ?? 0).toFixed(2)}
                  </p>
                </div>
                <span className="font-semibold">R$ {(item.total ?? 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <span className="text-lg font-semibold">Total</span>
            <span className="text-2xl font-bold">R$ {(order.total ?? 0).toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Atualizar status</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={order.status ?? "pendente"}
            onValueChange={(value) =>
              mutation.mutate({ data: { id: order.id, status: value } })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {order.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{order.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
