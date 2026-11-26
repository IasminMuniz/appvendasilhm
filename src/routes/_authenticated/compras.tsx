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
import { useDraft } from "@/hooks/use-draft";
import { DraftNotice, PendingDraftBanner } from "@/components/draft-notice";
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
import { RecordSearch, useRecordSearch } from "@/components/record-search";
import { COLORS, PATTERNS, SIZES, STYLES } from "@/lib/clothing";

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

/** unit = preço de UMA peça; o total do item é calculado (unit × quantidade). */
type NewProductForm = {
  name: string;
  style: string;
  color: string;
  pattern: string;
  size: string;
  price: string;
};
type ItemForm = {
  product_id: string;
  description: string;
  quantity: string;
  unit: string;
  /** Produto que ainda não existe: será cadastrado neste fornecedor ao salvar a compra. */
  new_product?: NewProductForm | null;
};
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
const NEW_PRODUCT = "__new__";
const emptyNewProduct = (): NewProductForm => ({
  name: "",
  style: "",
  color: "",
  pattern: "Liso",
  size: "Único",
  price: "",
});
const today = () => new Date().toISOString().slice(0, 10);
const emptyItem = (): ItemForm => ({ product_id: "", description: "", quantity: "1", unit: "" });
const itemTotal = (i: ItemForm) =>
  Math.round(Number(i.unit || 0) * Number(i.quantity || 1) * 100) / 100;
const unitOf = (amount: number, qty: number) =>
  String(Math.round((amount / Math.max(1, qty)) * 100) / 100);
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
  // Rascunho do cadastro novo: volta se a tela fechar antes de salvar.
  const draft = useDraft<Form>("compra-nova", form && !form.id ? form : null, {
    isEmpty: (v) => JSON.stringify(v) === JSON.stringify(empty()),
  });
  const [fromDraft, setFromDraft] = useState(false);
  const openNew = () => {
    const d = draft.readDraft();
    setFromDraft(!!d);
    setForm(d ? { ...empty(), ...d } : empty());
  };
  const done = () => {
    for (const k of ["purchases", "store-dashboard", "products", "orders", "order", "cash-flow"])
      qc.invalidateQueries({ queryKey: [k] });
  };
  const save = useMutation({
    mutationFn: savePurchase,
    onSuccess: () => {
      done();
      if (!form?.id) draft.clear();
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
  // Número da compra: vem do banco (purchase_number); até a migration ser aplicada, usa a ordem de cadastro.
  const codes = new Map<string, string>();
  [...purchases]
    .sort((a, b) =>
      `${a.purchase_date}${a.created_at}`.localeCompare(`${b.purchase_date}${b.created_at}`),
    )
    .forEach((p, i) => {
      const n = (p as { purchase_number?: number | null }).purchase_number ?? i + 1;
      codes.set(p.id, `C-${String(n).padStart(4, "0")}`);
    });
  const code = (id: string) => codes.get(id) ?? "";
  const search = useRecordSearch(purchases, (p) => [
    code(p.id),
    p.supplier,
    p.description,
    p.status,
    p.payment_method,
    p.notes,
    formatDate(p.purchase_date),
    ...p.purchase_items.flatMap((i) => [i.description, i.products?.name, i.products?.sku]),
  ]);
  const visible = search.results;
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
            unit: unitOf(Number(i.amount), Number(i.quantity)),
          }))
        : [{ product_id: "", description: p.description, quantity: "1", unit: String(p.amount) }],
    });

  // Mesmo nome pode existir em mais de um fornecedor: mostra só os produtos do fornecedor da compra.
  const ofSupplier = (products ?? []).filter((p) => form?.supplier && p.supplier === form.supplier);
  // Com fornecedor escolhido, só os produtos dele (o produto pertence ao fornecedor).
  const supplierProducts = form?.supplier ? ofSupplier : (products ?? []);

  const setItem = (idx: number, patch: Partial<ItemForm>) =>
    form &&
    setForm({ ...form, items: form.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) });

  const formTotal = form
    ? form.items.reduce((s, i) => s + itemTotal(i), 0) + Number(form.freight || 0)
    : 0;

  return (
    <div className="space-y-6">
      {draft.hasDraft && !form && (
        <PendingDraftBanner label="uma compra" onContinue={openNew} onDiscard={draft.clear} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Compras</h1>
          <p className="text-muted-foreground">Total investido: {formatCurrency(total)}</p>
        </div>
        <Button onClick={openNew} disabled={data.migrationPending}>
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
        <CardHeader className="space-y-3">
          <CardTitle>Compras registradas</CardTitle>
          <RecordSearch
            query={search.query}
            onQueryChange={search.setQuery}
            suggestions={[]}
            placeholder="Pesquisar por nº (C-0001), fornecedor, peça, status, pagamento..."
          />
        </CardHeader>
        <CardContent>
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma compra registrada.</p>
          ) : (
            <div className="divide-y">
              {visible.map((p) => (
                <div key={p.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{code(p.id)}</span>
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
                      <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50 text-xs text-muted-foreground">
                            <tr>
                              <th className="px-2 py-1.5 text-left font-medium">Produto</th>
                              <th className="px-2 py-1.5 text-left font-medium">SKU</th>
                              <th className="px-2 py-1.5 text-right font-medium">Qtd.</th>
                              <th className="px-2 py-1.5 text-right font-medium">
                                Preço de 1 peça
                              </th>
                              <th className="px-2 py-1.5 text-right font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {p.purchase_items.map((i) => (
                              <tr key={i.id}>
                                <td className="px-2 py-1.5">{i.products?.name ?? i.description}</td>
                                <td className="whitespace-nowrap px-2 py-1.5 font-mono text-xs text-muted-foreground">
                                  {i.products?.sku ?? "—"}
                                </td>
                                <td className="px-2 py-1.5 text-right">{i.quantity}</td>
                                <td className="whitespace-nowrap px-2 py-1.5 text-right">
                                  {formatCurrency(
                                    Number(i.amount) / Math.max(1, Number(i.quantity)),
                                  )}
                                </td>
                                <td className="whitespace-nowrap px-2 py-1.5 text-right">
                                  {formatCurrency(Number(i.amount))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="border-t text-xs">
                            <tr>
                              <td className="px-2 py-1.5 font-medium" colSpan={2}>
                                Total
                              </td>
                              <td className="px-2 py-1.5 text-right font-medium">
                                {p.purchase_items.reduce((t, i) => t + Number(i.quantity), 0)}
                              </td>
                              <td />
                              <td className="whitespace-nowrap px-2 py-1.5 text-right font-medium">
                                {formatCurrency(
                                  p.purchase_items.reduce((t, i) => t + Number(i.amount), 0),
                                )}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{form?.id ? `Editar compra ${code(form.id)}` : "Nova compra"}</DialogTitle>
          </DialogHeader>
          {form && !form.id && fromDraft && (
            <DraftNotice
              onDiscard={() => {
                draft.clear();
                setFromDraft(false);
                setForm(empty());
              }}
            />
          )}
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
                      .filter(
                        (i) => i.description.trim() || i.product_id || i.new_product?.name.trim(),
                      )
                      .map((i) => ({
                        product_id: i.product_id || null,
                        description: (i.new_product?.name || i.description).trim(),
                        quantity: Number(i.quantity || 1),
                        amount: itemTotal(i),
                        new_product:
                          !i.product_id && i.new_product
                            ? { ...i.new_product, price: Number(i.new_product.price || 0) }
                            : null,
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
                <div className="hidden gap-2 px-1 text-xs text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_4.5rem_7rem_6.5rem_2.25rem]">
                  <span>Produto</span>
                  <span>Qtd.</span>
                  <span>Preço de 1 peça</span>
                  <span>Total</span>
                  <span />
                </div>
                {form.items.map((it, idx) => (
                  <div
                    key={idx}
                    className="grid items-start gap-2 rounded-md border p-2 sm:grid-cols-[minmax(0,1fr)_4.5rem_7rem_6.5rem_2.25rem] sm:border-0 sm:p-0"
                  >
                    <div className="min-w-0 space-y-1">
                      <Select
                        value={it.product_id || (it.new_product ? NEW_PRODUCT : NO_PRODUCT)}
                        onValueChange={(v) => {
                          const prod = products?.find((p) => p.id === v);
                          setItem(
                            idx,
                            v === NO_PRODUCT
                              ? { product_id: "", description: "", new_product: null }
                              : v === NEW_PRODUCT
                                ? {
                                    product_id: "",
                                    description: "",
                                    new_product: emptyNewProduct(),
                                  }
                                : {
                                    product_id: v,
                                    new_product: null,
                                    description: [prod?.name, prod?.sku]
                                      .filter(Boolean)
                                      .join(" · "),
                                  },
                          );
                        }}
                      >
                        <SelectTrigger aria-label="Produto" className="min-w-0 [&>span]:truncate">
                          <SelectValue placeholder="Produto" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NEW_PRODUCT} disabled={!form.supplier}>
                            {form.supplier
                              ? `+ Produto novo da ${form.supplier}`
                              : "+ Produto novo (escolha o fornecedor antes)"}
                          </SelectItem>
                          <SelectItem value={NO_PRODUCT}>Sem produto (ex.: embalagem)</SelectItem>
                          {supplierProducts.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {[p.name, p.sku].filter(Boolean).join(" · ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!it.product_id && !it.new_product && (
                        <Input
                          placeholder="O que comprou (ex.: 10 envelopes)"
                          value={it.description}
                          onChange={(e) => setItem(idx, { description: e.target.value })}
                        />
                      )}
                    </div>
                    <Input
                      aria-label="Quantidade"
                      type="number"
                      min="1"
                      inputMode="numeric"
                      value={it.quantity}
                      onChange={(e) => setItem(idx, { quantity: e.target.value })}
                    />
                    <Input
                      aria-label="Preço de 1 peça (R$)"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                      value={it.unit}
                      onChange={(e) => setItem(idx, { unit: e.target.value })}
                    />
                    <p className="flex h-10 items-center text-sm font-medium">
                      {formatCurrency(itemTotal(it))}
                    </p>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Remover item"
                      disabled={form.items.length === 1}
                      onClick={() =>
                        setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    {it.new_product && (
                      <NewProductFields
                        value={it.new_product}
                        onChange={(np) => setItem(idx, { new_product: np })}
                      />
                    )}
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
                  Coloque o preço de UMA peça; o total é calculado sozinho. Ao marcar como Recebido,
                  o estoque e o custo do produto são atualizados — e o lucro das vendas também.
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

/** Campos do produto novo, cadastrado a partir da compra no fornecedor dela (o SKU sai sozinho). */
function NewProductFields({
  value,
  onChange,
}: {
  value: NewProductForm;
  onChange: (v: NewProductForm) => void;
}) {
  const set = (patch: Partial<NewProductForm>) => onChange({ ...value, ...patch });
  const pick = (
    key: "style" | "color" | "pattern" | "size",
    label: string,
    options: readonly string[],
  ) => (
    <label className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Select value={value[key] || undefined} onValueChange={(v) => set({ [key]: v })}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
  return (
    <div className="grid gap-2 rounded-md bg-muted/40 p-2 sm:col-span-5 sm:grid-cols-6">
      <label className="space-y-1 sm:col-span-6">
        <span className="text-xs text-muted-foreground">Nome do produto novo</span>
        <Input
          placeholder="Ex.: Vestido Longo Preto Três Marias com Bojo"
          value={value.name}
          onChange={(e) => set({ name: e.target.value })}
        />
      </label>
      {pick(
        "style",
        "Estilo",
        STYLES.map((x) => x.value),
      )}
      {pick(
        "color",
        "Cor",
        COLORS.map((x) => x.value),
      )}
      {pick(
        "pattern",
        "Padrão",
        PATTERNS.map((x) => x.value),
      )}
      {pick("size", "Tamanho", SIZES)}
      <label className="space-y-1 sm:col-span-2">
        <span className="text-xs text-muted-foreground">Preço de venda (R$)</span>
        <Input
          type="number"
          min="0"
          step="0.01"
          placeholder="139,90"
          value={value.price}
          onChange={(e) => set({ price: e.target.value })}
        />
      </label>
      <p className="text-xs text-muted-foreground sm:col-span-6">
        Ao salvar a compra, o produto é cadastrado neste fornecedor com SKU automático e já vai para
        Produtos. O custo é o preço de 1 peça desta compra.
      </p>
    </div>
  );
}
