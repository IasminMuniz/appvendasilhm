import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listCustomers } from "@/lib/customers.functions";
import { listProducts } from "@/lib/products.functions";
import { createQuote, getDiscountPolicies } from "@/lib/quotes.functions";
import { formatCurrency } from "@/lib/commercial-constants";

const newQuoteQueryOptions = () =>
  queryOptions({
    queryKey: ["quotes", "new-context"],
    queryFn: async () => {
      const [customers, products, policies] = await Promise.all([
        listCustomers(),
        listProducts(),
        getDiscountPolicies(),
      ]);
      return { customers, products, policies };
    },
  });

export const Route = createFileRoute("/_authenticated/orcamentos/novo")({
  loader: ({ context }) => context.queryClient.ensureQueryData(newQuoteQueryOptions()),
  component: NewQuotePage,
  head: () => ({
    meta: [
      { title: "Novo Orçamento - Plataforma Comercial" },
      {
        name: "description",
        content: "Monte propostas com itens, descontos e condições comerciais.",
      },
    ],
  }),
});

type Item = { product_id: string; quantity: number; unit_price: number; discount_percent: number };

function NewQuotePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(newQuoteQueryOptions());

  const [customerId, setCustomerId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [items, setItems] = useState<Item[]>([]);

  const activeProducts = data.products.filter((p) => p.active);

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const afterItems = items.reduce(
    (sum, i) => sum + i.quantity * i.unit_price * (1 - i.discount_percent / 100),
    0,
  );
  const total = afterItems * (1 - discount / 100);
  const effectiveDiscount = subtotal > 0 ? ((subtotal - total) / subtotal) * 100 : 0;
  const needsApproval = discount > data.policies.myLimit;

  const mutation = useMutation({
    mutationFn: createQuote,
    onSuccess: (quote) => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Orçamento criado");
      navigate({ to: "/orcamentos/$id", params: { id: quote.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addItem = () => {
    const first = activeProducts[0];
    if (!first) return toast.error("Cadastre um produto ativo primeiro.");
    setItems([
      ...items,
      {
        product_id: first.id,
        quantity: 1,
        unit_price: Number(first.price ?? 0),
        discount_percent: 0,
      },
    ]);
  };

  const updateItem = (index: number, patch: Partial<Item>) => {
    setItems(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" asChild>
        <Link to="/orcamentos">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Novo orçamento</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!customerId) return toast.error("Selecione o cliente");
              if (items.length === 0) return toast.error("Adicione pelo menos um item");
              mutation.mutate({
                data: {
                  customer_id: customerId,
                  discount_percent: discount,
                  notes,
                  commercial_terms: terms,
                  valid_until: validUntil,
                  items,
                },
              });
            }}
          >
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {data.customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company_name || c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Itens</Label>
                <Button type="button" size="sm" variant="outline" onClick={addItem}>
                  <Plus className="mr-1 h-3 w-3" />
                  Adicionar item
                </Button>
              </div>
              {items.map((item, index) => (
                <div key={index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-12">
                  <div className="sm:col-span-5">
                    <Select
                      value={item.product_id}
                      onValueChange={(value) => {
                        const product = activeProducts.find((p) => p.id === value);
                        updateItem(index, {
                          product_id: value,
                          unit_price: Number(product?.price ?? item.unit_price),
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {activeProducts.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    className="sm:col-span-2"
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                  />
                  <Input
                    className="sm:col-span-2"
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) => updateItem(index, { unit_price: Number(e.target.value) })}
                  />
                  <Input
                    className="sm:col-span-2"
                    type="number"
                    min={0}
                    max={100}
                    value={item.discount_percent}
                    onChange={(e) =>
                      updateItem(index, { discount_percent: Number(e.target.value) })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="sm:col-span-1"
                    onClick={() => setItems(items.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {items.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum item adicionado.</p>
              )}
              <p className="text-xs text-muted-foreground">
                Colunas: produto, quantidade, preço unitário e desconto do item (%).
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="discount">Desconto geral (%)</Label>
                <Input
                  id="discount"
                  type="number"
                  min={0}
                  max={100}
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Seu limite de aprovação: {data.policies.myLimit}%
                  {needsApproval ? " — exigirá aprovação superior." : ""}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="valid">Válido até</Label>
                <Input
                  id="valid"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="terms">Condições comerciais</Label>
              <Textarea
                id="terms"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Prazo de pagamento, frete, validade..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="rounded-lg border bg-muted/40 p-4 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Desconto efetivo</span>
                <span>{effectiveDiscount.toFixed(1)}%</span>
              </div>
              <div className="mt-2 flex justify-between border-t pt-2 text-lg font-bold">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : "Criar orçamento"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
