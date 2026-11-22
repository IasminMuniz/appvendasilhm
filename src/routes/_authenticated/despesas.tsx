import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteExpense, listExpenses, saveExpense } from "@/lib/finance.functions";
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

type Form = { id?: string; expense_date: string; description: string; category: string; amount: string; is_fixed: boolean };
const empty = (): Form => ({ expense_date: new Date().toISOString().slice(0, 10), description: "", category: "", amount: "", is_fixed: false });

function ExpensesPage() {
  const { data } = useSuspenseQuery(expensesQuery());
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const done = () => { qc.invalidateQueries({ queryKey: ["expenses"] }); qc.invalidateQueries({ queryKey: ["store-dashboard"] }); };
  const save = useMutation({
    mutationFn: saveExpense,
    onSuccess: () => { done(); setForm(null); toast.success("Despesa salva."); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => { done(); toast.success("Despesa excluída."); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Despesas</h1>
          <p className="text-muted-foreground">Marque como fixa o que se repete todo mês (aluguel, internet...).</p>
        </div>
        <Button onClick={() => setForm(empty())}><Plus className="mr-2 h-4 w-4" />Nova despesa</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Despesas registradas</CardTitle></CardHeader>
        <CardContent>
          {data.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma despesa registrada.</p> : (
            <div className="divide-y">
              {data.map((x) => (
                <div key={x.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{x.description}</p>
                    <p className="text-sm text-muted-foreground">{[formatDate(x.expense_date), x.category].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {x.is_fixed && <Badge variant="secondary">Fixa</Badge>}
                    <span className="font-semibold">{formatCurrency(Number(x.amount))}</span>
                    <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setForm({ id: x.id, expense_date: x.expense_date, description: x.description, category: x.category ?? "", amount: String(x.amount), is_fixed: x.is_fixed })}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => confirm("Excluir esta despesa?") && remove.mutate({ data: { id: x.id } })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? "Editar despesa" : "Nova despesa"}</DialogTitle></DialogHeader>
          {form && (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate({ data: { ...form, amount: Number(form.amount || 0) } }); }}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="ed">Data</Label><Input id="ed" type="date" required value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></div>
                <div className="space-y-2">
                  <Label htmlFor="cat">Categoria</Label>
                  <Select value={form.category || undefined} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger id="cat"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2"><Label htmlFor="desc">Descrição *</Label><Input id="desc" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="amt">Valor (R$)</Label><Input id="amt" type="number" min="0" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div className="flex items-center gap-2">
                <Checkbox id="fixed" checked={form.is_fixed} onCheckedChange={(c) => setForm({ ...form, is_fixed: c === true })} />
                <Label htmlFor="fixed" className="font-normal">Despesa fixa</Label>
              </div>
              <Button type="submit" className="w-full" disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar despesa"}</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
