import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CheckCircle2, Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RecordSearch, useRecordSearch } from "@/components/record-search";
import {
  EXPENSE_STATUSES,
  PAYMENT_METHODS,
  deleteExpense,
  listExpenses,
  saveExpense,
} from "@/lib/finance.functions";
import { EXPENSE_CATEGORIES } from "@/lib/store-metrics";
import { formatCurrency, formatDate } from "@/lib/commercial-constants";

const expensesQuery = () => queryOptions({ queryKey: ["expenses"], queryFn: () => listExpenses() });

export const Route = createFileRoute("/_authenticated/despesas")({
  loader: ({ context }) => context.queryClient.ensureQueryData(expensesQuery()),
  component: ExpensesPage,
  head: () => ({
    meta: [
      { title: "Despesas - Nexus 360" },
      { name: "description", content: "Controle as despesas fixas e variáveis da loja." },
      { property: "og:title", content: "Despesas - Nexus 360" },
      { property: "og:description", content: "Despesas da loja por mês e categoria." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Status = (typeof EXPENSE_STATUSES)[number];
type Expense = Awaited<ReturnType<typeof listExpenses>>[number];
type Form = {
  id?: string;
  expense_date: string;
  purchase_date: string;
  description: string;
  category: string;
  payment_method: string;
  amount: string;
  is_fixed: boolean;
  status: Status;
  paid_at: string;
  repeat_months: string;
};
type StatusFilter = "Todas" | Status;

const ALL_MONTHS = "todos";
const today = () => new Date().toISOString().slice(0, 10);
const empty = (): Form => ({
  expense_date: today(),
  purchase_date: today(),
  description: "",
  category: "",
  payment_method: "",
  amount: "",
  is_fixed: false,
  status: "Pendente",
  paid_at: "",
  repeat_months: "12",
});
const statusOf = (x: { status?: string | null }): Status =>
  x.status === "Pago" ? "Pago" : "Pendente";
const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const name = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("pt-BR", {
    month: "long",
    timeZone: "UTC",
  });
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${y}`;
};
const sum = (rows: Expense[]) => rows.reduce((t, x) => t + Number(x.amount ?? 0), 0);

function ExpensesPage() {
  const { data } = useSuspenseQuery(expensesQuery());
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [toDelete, setToDelete] = useState<Expense | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Todas");
  const [month, setMonth] = useState(ALL_MONTHS);

  const done = () => {
    qc.invalidateQueries({ queryKey: ["expenses"] });
    qc.invalidateQueries({ queryKey: ["store-dashboard"] });
  };
  const save = useMutation({
    mutationFn: saveExpense,
    onSuccess: (r) => {
      done();
      setForm(null);
      toast.success(r.created > 1 ? `${r.created} lançamentos mensais criados.` : "Despesa salva.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const markPaid = useMutation({
    mutationFn: saveExpense,
    onSuccess: () => {
      done();
      toast.success("Despesa marcada como paga.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      done();
      setToDelete(null);
      toast.success("Despesa excluída.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const months = useMemo(
    () => [...new Set(data.map((x) => x.expense_date.slice(0, 7)))].sort().reverse(),
    [data],
  );
  const filtered = data.filter(
    (x) =>
      (statusFilter === "Todas" || statusOf(x) === statusFilter) &&
      (month === ALL_MONTHS || x.expense_date.startsWith(month)),
  );
  const search = useRecordSearch(filtered, (x) => [
    x.description,
    x.category,
    statusOf(x),
    x.is_fixed ? "Fixa" : "Variável",
    formatDate(x.expense_date),
    String(x.amount),
  ]);
  const visible = search.results;
  // Pendentes primeiro (mais antigas no topo), depois pagas (mais recentes no topo).
  const ordered = [...visible].sort((a, b) => {
    const sa = statusOf(a),
      sb = statusOf(b);
    if (sa !== sb) return sa === "Pendente" ? -1 : 1;
    return sa === "Pendente"
      ? a.expense_date.localeCompare(b.expense_date)
      : b.expense_date.localeCompare(a.expense_date);
  });

  const scope = month === ALL_MONTHS ? data : data.filter((x) => x.expense_date.startsWith(month));
  const totalPaid = sum(scope.filter((x) => statusOf(x) === "Pago"));
  const totalPending = sum(scope.filter((x) => statusOf(x) === "Pendente"));
  const overdue = data.filter((x) => statusOf(x) === "Pendente" && x.expense_date < today());

  const edit = (x: Expense) =>
    setForm({
      id: x.id,
      expense_date: x.expense_date,
      purchase_date: x.purchase_date ?? x.expense_date,
      description: x.description,
      category: x.category ?? "",
      payment_method: x.payment_method ?? "",
      amount: String(x.amount),
      is_fixed: x.is_fixed,
      status: statusOf(x),
      paid_at: x.paid_at ?? "",
      repeat_months: "1",
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Despesas</h1>
          <p className="text-muted-foreground">
            Despesas fixas (DAS, assinaturas) podem ser lançadas de uma vez para os próximos meses.
          </p>
        </div>
        <Button onClick={() => setForm(empty())}>
          <Plus className="mr-2 h-4 w-4" />
          Nova despesa
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pendente {month === ALL_MONTHS ? "(total)" : "no mês"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalPending)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pago {month === ALL_MONTHS ? "(total)" : "no mês"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vencidas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${overdue.length ? "text-destructive" : ""}`}>
              {overdue.length} · {formatCurrency(sum(overdue))}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Despesas registradas</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {(["Todas", "Pendente", "Pago"] as const).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={statusFilter === s ? "default" : "outline"}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === "Todas" ? "Todas" : s === "Pago" ? "Pagas" : "Pendentes"}
                </Button>
              ))}
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="h-8 w-48" aria-label="Mês">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_MONTHS}>Todos os meses</SelectItem>
                  {months.map((m) => (
                    <SelectItem key={m} value={m}>
                      {monthLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <RecordSearch
            query={search.query}
            onQueryChange={search.setQuery}
            suggestions={[]}
            placeholder="Pesquisar por descrição, categoria, valor..."
          />
        </CardHeader>
        <CardContent>
          {ordered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {data.length === 0
                ? "Nenhuma despesa registrada."
                : "Nenhuma despesa com esses filtros. Escolha Todas e Todos os meses para ver tudo."}
            </p>
          ) : (
            <div className="divide-y">
              {ordered.map((x) => {
                const st = statusOf(x);
                const late = st === "Pendente" && x.expense_date < today();
                return (
                  <div
                    key={x.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{x.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {[
                          x.purchase_date &&
                            x.purchase_date !== x.expense_date &&
                            `Compra ${formatDate(x.purchase_date)}`,
                          `${st === "Pago" ? "Venceu" : "Vence"} ${formatDate(x.expense_date)}`,
                          x.category,
                          x.payment_method,
                          x.paid_at && `Pago em ${formatDate(x.paid_at)}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={st === "Pago" ? "default" : late ? "destructive" : "secondary"}
                      >
                        {late ? "Vencida" : st}
                      </Badge>
                      {x.is_fixed && (
                        <Badge variant="outline" className="gap-1">
                          <Repeat className="h-3 w-3" />
                          Fixa
                        </Badge>
                      )}
                      <span className="font-semibold">{formatCurrency(Number(x.amount))}</span>
                      {st === "Pendente" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Marcar como paga"
                          title="Marcar como paga"
                          disabled={markPaid.isPending}
                          onClick={() =>
                            markPaid.mutate({
                              data: {
                                id: x.id,
                                expense_date: x.expense_date,
                                purchase_date: x.purchase_date ?? "",
                                description: x.description,
                                category: x.category ?? "",
                                payment_method: x.payment_method ?? "",
                                amount: Number(x.amount),
                                is_fixed: x.is_fixed,
                                status: "Pago",
                                paid_at: today(),
                                repeat_months: 1,
                              },
                            })
                          }
                        >
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Editar"
                        onClick={() => edit(x)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Excluir"
                        onClick={() => setToDelete(x)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir despesa?</DialogTitle>
            <DialogDescription>
              {toDelete?.description} · {toDelete && formatDate(toDelete.expense_date)}
            </DialogDescription>
          </DialogHeader>
          {toDelete?.is_fixed && (
            <p className="text-sm text-muted-foreground">
              É uma despesa fixa. Se você cancelou o serviço, exclua também os próximos meses que
              ainda estão pendentes. Os meses já pagos ficam registrados.
            </p>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              disabled={remove.isPending}
              onClick={() => toDelete && remove.mutate({ data: { id: toDelete.id, scope: "one" } })}
            >
              Excluir só esta
            </Button>
            {toDelete?.is_fixed && (
              <Button
                variant="destructive"
                disabled={remove.isPending}
                onClick={() =>
                  toDelete && remove.mutate({ data: { id: toDelete.id, scope: "future" } })
                }
              >
                Excluir esta e as próximas pendentes
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar despesa" : "Nova despesa"}</DialogTitle>
          </DialogHeader>
          {form && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate({
                  data: {
                    ...form,
                    amount: Number(form.amount || 0),
                    repeat_months: form.id ? 1 : Number(form.repeat_months || 1),
                  },
                });
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pd">Data da compra</Label>
                  <Input
                    id="pd"
                    type="date"
                    required
                    value={form.purchase_date}
                    onChange={(e) => {
                      const v = e.target.value;
                      // Enquanto o vencimento acompanha a compra, ele segue junto.
                      const follow = !form.id && form.expense_date === form.purchase_date;
                      setForm({
                        ...form,
                        purchase_date: v,
                        ...(follow ? { expense_date: v } : {}),
                      });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ed">Data de vencimento</Label>
                  <Input
                    id="ed"
                    type="date"
                    required
                    value={form.expense_date}
                    onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    No cartão de crédito, use o vencimento da fatura.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cat">Categoria</Label>
                  <Select
                    value={form.category || undefined}
                    onValueChange={(v) => setForm({ ...form, category: v })}
                  >
                    <SelectTrigger id="cat">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pm">Forma de pagamento</Label>
                  <Select
                    value={form.payment_method || undefined}
                    onValueChange={(v) => setForm({ ...form, payment_method: v })}
                  >
                    <SelectTrigger id="pm">
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
                <Label htmlFor="desc">Descrição *</Label>
                <Input
                  id="desc"
                  required
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amt">Valor (R$)</Label>
                <Input
                  id="amt"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="st">Situação</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        status: v as Status,
                        paid_at: v === "Pago" ? form.paid_at || today() : "",
                      })
                    }
                  >
                    <SelectTrigger id="st">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_STATUSES.map((st) => (
                        <SelectItem key={st} value={st}>
                          {st}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {form.status === "Pago" && (
                  <div className="space-y-2">
                    <Label htmlFor="pa">Data do pagamento</Label>
                    <Input
                      id="pa"
                      type="date"
                      required
                      value={form.paid_at}
                      onChange={(e) => setForm({ ...form, paid_at: e.target.value })}
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="fixed"
                  checked={form.is_fixed}
                  onCheckedChange={(c) => setForm({ ...form, is_fixed: c === true })}
                />
                <Label htmlFor="fixed" className="font-normal">
                  Despesa fixa (se repete todo mês)
                </Label>
              </div>
              {form.is_fixed && !form.id && (
                <div className="space-y-2 rounded-md border bg-muted/40 p-3">
                  <Label htmlFor="rep">Lançar para quantos meses?</Label>
                  <Input
                    id="rep"
                    type="number"
                    min="1"
                    max="60"
                    className="w-28"
                    value={form.repeat_months}
                    onChange={(e) => setForm({ ...form, repeat_months: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Cria um lançamento por mês, no mesmo dia, a partir da data acima (até 60 meses).
                    Os meses seguintes ficam como Pendente. Se cancelar o serviço, exclua os
                    próximos pelo ícone de lixeira.
                  </p>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={save.isPending}>
                {save.isPending ? "Salvando..." : "Salvar despesa"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
