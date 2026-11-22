import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { ArrowLeft, History, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import {
  deleteOrder,
  getOrder,
  updateOrderSaleInfo,
  updateOrderStatus,
} from "@/lib/orders.functions";
import { SaleFields, SaleSummary, toSaleInput } from "@/components/sales/sale-fields";
import { OrderPaymentsCard } from "@/components/sales/payment-plan";
import { useState } from "react";

import { ORDER_STATUSES, ORDER_STATUS_LABELS, formatCurrency } from "@/lib/commercial-constants";

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
    meta: [
      { title: "Detalhes da venda - Nexus 360" },
      {
        name: "description",
        content: "Itens, canal, lucro, status e histórico da venda.",
      },
    ],
  }),
});

function OrderDetailPage() {
  const { id } = useParams({ from: "/_authenticated/pedidos/$id" });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(orderQueryOptions(id));
  const order = data.order;
  const saleItems = (order.order_items ?? []).map((i) => ({
    unit_price: Number(i.unit_price ?? 0),
    quantity: Number(i.quantity ?? 0),
  }));
  const pieces = saleItems.reduce((s, i) => s + i.quantity, 0);
  const packagingPerPiece = pieces > 0 ? Number(order.packaging_cost ?? 0) / pieces : 0;

  const mutation = useMutation({
    mutationFn: updateOrderStatus,
    onSuccess: () => {
      toast.success("Status atualizado");
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const [sale, setSale] = useState({
    channel: order.channel ?? "",
    payment_method: order.payment_method ?? "",
    delivery_method: order.delivery_method ?? "",
    other_costs: String(order.other_costs ?? 0),
    other_cost_type: order.other_cost_type ?? "",
  });
  const saveSale = useMutation({
    mutationFn: updateOrderSaleInfo,
    onSuccess: () => {
      toast.success("Dados da venda atualizados");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: deleteOrder,
    onSuccess: () => {
      toast.success("Venda excluída");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      navigate({ to: "/pedidos" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link to="/pedidos">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={remove.isPending}>
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir venda
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir venda?</AlertDialogTitle>
              <AlertDialogDescription>
                Os itens e o histórico de status serão removidos permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => remove.mutate({ data: { id } })}>
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Venda</h1>
          <p className="text-muted-foreground">
            {new Date(order.created_at).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <Badge variant="outline">{ORDER_STATUS_LABELS[order.status] ?? order.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="font-medium">
            {order.customers?.company_name || order.customers?.name || "Cliente"}
          </p>
          {order.customers?.email && (
            <p className="text-sm text-muted-foreground">{order.customers.email}</p>
          )}
          {order.customers?.phone && (
            <p className="text-sm text-muted-foreground">{order.customers.phone}</p>
          )}
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
                    {item.quantity} x {formatCurrency(Number(item.unit_price ?? 0))}
                  </p>
                </div>
                <span className="font-semibold">{formatCurrency(Number(item.total ?? 0))}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <span className="text-lg font-semibold">Total</span>
            <span className="text-2xl font-bold">{formatCurrency(Number(order.total ?? 0))}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Canal, pagamento e lucro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SaleFields value={sale} onChange={setSale} />
          <SaleSummary
            items={saleItems}
            channel={sale.channel}
            otherCosts={Number(sale.other_costs || 0)}
            productCost={Number(order.product_cost ?? 0)}
            packagingCost={packagingPerPiece}
          />
          <Button
            disabled={saveSale.isPending}
            onClick={() => saveSale.mutate({ data: { id: order.id, ...toSaleInput(sale) } })}
          >
            {saveSale.isPending ? "Salvando..." : "Salvar dados da venda"}
          </Button>
        </CardContent>
      </Card>

      <OrderPaymentsCard
        orderId={order.id}
        total={Number(order.total ?? 0)}
        method={order.payment_method ?? null}
      />

      <Card>
        <CardHeader>
          <CardTitle>Atualizar status</CardTitle>
          <p className="text-sm text-muted-foreground">
            Ao marcar como Pago, o estoque dos produtos é baixado.
          </p>
        </CardHeader>
        <CardContent>
          <Select
            value={order.status}
            onValueChange={(value) => mutation.mutate({ data: { id: order.id, status: value } })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o status" />
            </SelectTrigger>
            <SelectContent>
              {ORDER_STATUSES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico de status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
          ) : (
            <div className="space-y-3">
              {data.history.map((entry) => (
                <div key={entry.id} className="border-l-2 border-primary/40 pl-3">
                  <p className="text-sm font-medium">
                    {entry.from_status
                      ? `${ORDER_STATUS_LABELS[entry.from_status] ?? entry.from_status} → `
                      : ""}
                    {ORDER_STATUS_LABELS[entry.to_status] ?? entry.to_status}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.changed_by_name} · {new Date(entry.created_at).toLocaleString("pt-BR")}
                  </p>
                  {entry.note && <p className="text-xs text-muted-foreground">{entry.note}</p>}
                </div>
              ))}
            </div>
          )}
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
