import { createFileRoute } from "@tanstack/react-router";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PURCHASE_STATUSES,
  deletePurchase,
  listPurchases,
  savePurchase,
} from "@/lib/finance.functions";
import { listProducts } from "@/lib/products.functions";
import { suppliersQueryOptions } from "@/components/products/product-form";
import { PAYMENT_METHODS } from "@/lib/sales";
import { formatCurrency, formatDate } from "@/lib/commercial-constants";

const purchasesQuery = () =>
  queryOptions({ queryKey: ["purchases"], queryFn: () => listPurchases() });
const productsQuery = () => queryOptions({ queryKey: ["products"], queryFn: () => listProducts() });

export const Route = createFileRoute("/_authenticated/compras")({
  loader: ({ context }) => context.queryClient.ensureQueryData(purchasesQuery()),
  component: PurchasesPage,
  head: () => ({
    meta: [
      { title: "Compras - Nexus 360" },
      { name: "description", content: "Registre as compras de mercadorias e embalagens da loja." },
      { property: "og:title", content: "Compras - Nexus 360" },
      { property: "og:description", content: "Compras, itens, estoque e total investido." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type ItemForm = { product_id: string; description: string; quantity: string; amount: string };
type Form = {
  id?: string;
  purchase_date: string;
  supplier: string;
  status: (typeof PURCHASE_STATUSES)[number];
  payment_method: string;
  freight: string;
  notes: string;
  items: ItemForm[];
};

const NO_PRODUCT = "__none__";
const today = () => new Date().toISOString().slice(0, 10);
const emptyItem = (): ItemForm => ({ product_id: "", description: "", quantity: "1", amount: "" });
const empty = (): Form => ({
  purchase_date: today(),
  supplier: "PML Fashion",
  status: "Pedido",
  payment_method: "Pix",
  freight: "0",
  notes: "",
  items: [emptyItem()],
});

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  Recebido: "default",
  Pedido: "secondary",
  Cancelado: "destructive",
};

function PurchasesPage() {
  const { data } = useSuspenseQuery(purchasesQuery());
  const { data: products } = useQuery(productsQuery());
  const { data: suppliers } = useQuery(suppliersQueryOptions);
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const done = () => {
    for (const k of ["purchases", "store-dashboard", "products"])
      qc.invalidateQueries({ queryKey: [k] });
  };
  const save = useMutation({
    mutationFn: savePurchase,
    onSuccess: () => {
      done();
      setForm(null);
      toast.success("Compra salva.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: deletePurchase,
    onSuccess: () => {
      done();
      toast.success("Compra excluída.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const purchases = data.purchases;
  const total = purchases
    .filter((p) => p.status !== "Cancelado")
    .reduce((s, p) => s + Number(p.amount ?? 0), 0);

  const edit = (p: (typeof purchases)[number]) =>
    setForm({
      id: p.id,
      purchase_date: p.purchase_date,
      supplier: p.supplier ?? "",
      status: (PURCHASE_STATUSES as readonly string[]).includes(p.status)
        ? (p.status as Form["status"])
        : "Pedido",
      payment_method: p.payment_method ?? "",
      freight: String(p.freight ?? 0),
      notes: p.notes ?? "",
      items: p.purchase_items.length
        ? p.purchase_items.map((i) => ({
            product_id: i.product_id ?? "",
            description: i.description,
            quantity: String(i.quantity),
            amount: String(i.amount),
          }))
        : [{ product_id: "", description: p.description, quantity: "1", amount: String(p.amount) }],
    });

  const setItem = (idx: number, patch: Partial<ItemForm>) =>
    form &&
    setForm({ ...form, items: form.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) });

  const formTotal = form
    ? form.items.reduce((s, i) => s + Number(i.amount || 0), 0) + Number(form.freight || 0)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Compras</h1>
          <p className="text-muted-foreground">Total investido: {formatCurrency(total)}</p>
        </div>
        <Button onClick={() => setForm(empty())} disabled={data.migrationPending}>
          <Plus className="mr-2 h-4 w-4" />
          Nova compra
        </Button>
      </div>

      {data.migrationPending && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Atualização do banco pendente</AlertTitle>
          <AlertDescription>
            Para usar itens e estoque nas compras, peça no chat do Lovable: "Aplique as migrations
            pendentes da pasta drizzle/migrations".
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Compras registradas</CardTitle>
        </CardHeader>
        <CardContent>
          {purchases.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma compra registrada.</p>
          ) : (
            <div className="divide-y">
              {purchases.map((p) => (
                <div key={p.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{p.supplier || "Sem fornecedor"}</p>
                      {p.status && (
                        <Badge variant={STATUS_VARIANT[p.status] ?? "secondary"}>{p.status}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {[
                        formatDate(p.purchase_date),
                        p.payment_method,
                        Number(p.freight ?? 0) > 0 && `Frete ${formatCurrency(Number(p.freight))}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {p.purchase_items.length > 0 ? (
                      <ul className="text-sm">
                        {p.purchase_items.map((i) => (
                          <li key={i.id}>
                            {i.quantity}× {i.products?.name ?? i.description} —{" "}
                            {formatCurrency(Number(i.amount))}
                            {i.products?.sku && (
                              <span className="ml-1 font-mono text-xs text-muted-foreground">
                                {i.products.sku}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm">{p.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{formatCurrency(Number(p.amount))}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Editar"
                      disabled={data.migrationPending}
                      onClick={() => edit(p)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Excluir"
                      onClick={() =>
                        confirm(
                          "Excluir esta compra? Se ela já foi recebida, o estoque será devolvido.",
                        ) && remove.mutate({ data: { id: p.id } })
                      }
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar compra" : "Nova compra"}</DialogTitle>
          </DialogHeader>
          {form && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate({
                  data: {
                    id: form.id,
                    purchase_date: form.purchase_date,
                    supplier: form.supplier,
                    status: form.status,
                    payment_method: form.payment_method,
                    freight: Number(form.freight || 0),
                    notes: form.notes,
                    items: form.items
                      .filter((i) => i.description.trim() || i.product_id)
                      .map((i) => ({
                        product_id: i.product_id || null,
                        description: i.description.trim(),
                        quantity: Number(i.quantity || 1),
                        amount: Number(i.amount || 0),
                      })),
                  },
                });
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pd">Data</Label>
                  <Input
                    id="pd"
                    type="date"
                    required
                    value={form.purchase_date}
                    onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sup">Fornecedor</Label>
                  <Select
                    value={form.supplier || undefined}
                    onValueChange={(v) => setForm({ ...form, supplier: v })}
                  >
                    <SelectTrigger id="sup">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {(suppliers ?? []).map((s) => (
                        <SelectItem key={s.code} value={s.name}>
                          {s.name} ({s.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="st">Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm({ ...form, status: v as Form["status"] })}
                  >
                    <SelectTrigger id="st">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PURCHASE_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pay">Pagamento</Label>
                  <Select
                    value={form.payment_method || undefined}
                    onValueChange={(v) => setForm({ ...form, payment_method: v })}
                  >
                    <SelectTrigger id="pay">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Itens</Label>
                {form.items.map((it, idx) => (
                  <div key={idx} className="grid gap-2 rounded-md border p-2 sm:grid-cols-12">
                    <div className="sm:col-span-5">
                      <Select
                        value={it.product_id || NO_PRODUCT}
                        onValueChange={(v) => {
                          const prod = products?.find((p) => p.id === v);
                          setItem(
                            idx,
                            v === NO_PRODUCT
                              ? { product_id: "" }
                              : { product_id: v, description: prod?.name ?? it.description },
                          );
                        }}
                      >
                        <SelectTrigger aria-label="Produto">
                          <SelectValue placeholder="Produto" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_PRODUCT}>Sem produto (ex.: embalagem)</SelectItem>
                          {(products ?? []).map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                              {p.sku ? ` · ${p.sku}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      className="sm:col-span-3"
                      placeholder="Descrição"
                      value={it.description}
                      onChange={(e) => setItem(idx, { description: e.target.value })}
                    />
                    <Input
                      className="sm:col-span-1"
                      type="number"
                      min="1"
                      aria-label="Quantidade"
                      value={it.quantity}
                      onChange={(e) => setItem(idx, { quantity: e.target.value })}
                    />
                    <Input
                      className="sm:col-span-2"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Valor pago"
                      aria-label="Valor pago no item"
                      value={it.amount}
                      onChange={(e) => setItem(idx, { amount: e.target.value })}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="sm:col-span-1"
                      aria-label="Remover item"
                      disabled={form.items.length === 1}
                      onClick={() =>
                        setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setForm({ ...form, items: [...form.items, emptyItem()] })}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Adicionar item
                </Button>
                <p className="text-xs text-muted-foreground">
                  Valor pago = total do item (ex.: 5 vestidos de R$ 73 = R$ 365). Ao marcar como
                  Recebido, a quantidade entra no estoque e o custo do produto é atualizado.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fr">Frete (R$)</Label>
                  <Input
                    id="fr"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.freight}
                    onChange={(e) => setForm({ ...form, freight: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Total da compra</Label>
                  <p className="flex h-9 items-center text-lg font-semibold">
                    {formatCurrency(formTotal)}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Input
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={save.isPending}>
                {save.isPending ? "Salvando..." : "Salvar compra"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
