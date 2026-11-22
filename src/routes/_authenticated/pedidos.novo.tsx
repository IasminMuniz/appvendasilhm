import {
  PaymentPlanFields,
  emptyPaymentPlan,
  toPaymentPlanInput,
} from "@/components/sales/payment-plan";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listCustomers } from "@/lib/customers.functions";
import { listProducts } from "@/lib/products.functions";
import { createOrder } from "@/lib/orders.functions";
import {
  SaleFields,
  SaleSummary,
  emptySaleInfo,
  toSaleInput,
} from "@/components/sales/sale-fields";
import { packagingCostQuery } from "@/components/store/packaging-cost-card";
import { DEFAULT_PACKAGING_COST } from "@/lib/sales";

const customersQueryOptions = () =>
  queryOptions({
    queryKey: ["customers"],
    queryFn: () => listCustomers(),
  });

const productsQueryOptions = () =>
  queryOptions({
    queryKey: ["products"],
    queryFn: () => listProducts(),
  });

export const Route = createFileRoute("/_authenticated/pedidos/novo")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(customersQueryOptions()),
      context.queryClient.ensureQueryData(productsQueryOptions()),
    ]),
  component: NewOrderPage,
  head: () => ({
    meta: [
      { title: "Nova venda - Nexus 360" },
      {
        name: "description",
        content: "Registre uma venda com canal, pagamento, entrega, taxa e lucro calculados.",
      },
      { property: "og:title", content: "Nova venda - Nexus 360" },
      { property: "og:description", content: "Registro de vendas da loja com lucro automático." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

interface OrderItem {
  product_id: string;
  quantity: number;
  unit_price: number;
}

function NewOrderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: customers } = useSuspenseQuery(customersQueryOptions());
  const { data: products } = useSuspenseQuery(productsQueryOptions());
  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OrderItem[]>([{ product_id: "", quantity: 1, unit_price: 0 }]);
  const [error, setError] = useState<string | null>(null);
  const [sale, setSale] = useState(emptySaleInfo);
  const [payPlan, setPayPlan] = useState(emptyPaymentPlan);
  const { data: packaging } = useQuery(packagingCostQuery);

  const activeProducts = products.filter((p) => p.active);

  const updateItem = (index: number, field: keyof OrderItem, value: string | number) => {
    const next = [...items];
    if (field === "product_id") {
      const product = products.find((p) => p.id === value);
      next[index] = {
        ...next[index],
        product_id: value as string,
        unit_price: product?.price ?? 0,
      };
    } else {
      next[index] = { ...next[index], [field]: value };
    }
    setItems(next);
  };

  const addItem = () => {
    setItems([...items, { product_id: "", quantity: 1, unit_price: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const total = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const productCost = items.reduce((sum, item) => {
    const p = products.find((x) => x.id === item.product_id);
    return sum + Number(p?.cost ?? 0) * item.quantity;
  }, 0);

  const mutation = useMutation({
    mutationFn: createOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      navigate({ to: "/pedidos" });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Erro ao criar venda.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!customerId) {
      setError("Selecione um cliente.");
      return;
    }
    const validItems = items.filter((item) => item.product_id && item.quantity > 0);
    if (validItems.length === 0) {
      setError("Adicione pelo menos um item válido.");
      return;
    }
    mutation.mutate({
      data: {
        customer_id: customerId,
        notes,
        items: validItems,
        ...toSaleInput(sale),
        ...toPaymentPlanInput(payPlan),
      },
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" asChild>
        <Link to="/pedidos">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Nova venda</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="customer">Cliente *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger id="customer">
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <Label>Itens da venda</Label>
              {items.map((item, index) => (
                <div key={index} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-12">
                  <div className="sm:col-span-6">
                    <Select
                      value={item.product_id}
                      onValueChange={(value) => updateItem(index, "product_id", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeProducts.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} - R$ {(product.price ?? 0).toFixed(2)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", Number(e.target.value))}
                      placeholder="Qtd"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.unit_price}
                      onChange={(e) => updateItem(index, "unit_price", Number(e.target.value))}
                      placeholder="Preço unit."
                    />
                  </div>
                  <div className="flex items-center justify-end sm:col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addItem}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar item
              </Button>
            </div>

            <SaleFields value={sale} onChange={setSale} />

            <PaymentPlanFields
              value={payPlan}
              onChange={setPayPlan}
              total={total}
              method={sale.payment_method}
            />

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <span className="text-lg font-semibold">Total</span>
              <span className="text-2xl font-bold">R$ {total.toFixed(2)}</span>
            </div>

            <SaleSummary
              items={items.filter((i) => i.product_id)}
              channel={sale.channel}
              otherCosts={Number(sale.other_costs || 0)}
              productCost={productCost}
              packagingCost={
                sale.include_packaging ? (packaging?.value ?? DEFAULT_PACKAGING_COST) : 0
              }
            />

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : "Registrar venda"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
