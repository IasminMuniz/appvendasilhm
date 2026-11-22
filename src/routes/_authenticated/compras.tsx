import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deletePurchase, listPurchases, savePurchase } from "@/lib/finance.functions";
import { SUPPLIERS } from "@/lib/clothing";
import { formatCurrency, formatDate } from "@/lib/commercial-constants";

const purchasesQuery = () => queryOptions({ queryKey: ["purchases"], queryFn: () => listPurchases() });

export const Route = createFileRoute("/_authenticated/compras")({
  loader: ({ context }) => context.queryClient.ensureQueryData(purchasesQuery()),
  component: PurchasesPage,
  head: () => ({
    meta: [
      { title: "Compras - Nexus 360" },
      { name: "description", content: "Registre as compras de mercadorias da loja." },
      { property: "og:title", content: "Compras - Nexus 360" },
      { property: "og:description", content: "Compras de mercadorias e total investido." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Form = { id?: string; purchase_date: string; supplier: string; description: string; amount: string; notes: string };
const today = () => new Date().toISOString().slice(0, 10);
const empty = (): Form => ({ purchase_date: today(), supplier: "PML Fashion", description: "", amount: "", notes: "" });

function PurchasesPage() {
  const { data } = useSuspenseQuery(purchasesQuery());
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const done = () => { qc.invalidateQueries({ queryKey: ["purchases"] }); qc.invalidateQueries({ queryKey: ["store-dashboard"] }); };
  const save = useMutation({
    mutationFn: savePurchase,
    onSuccess: () => { done(); setForm(null); toast.success("Compra salva."); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: deletePurchase,
    onSuccess: () => { done(); toast.success("Compra excluída."); },
    onError: (e: Error) => toast.error(e.message),
  });
  const total = data.reduce((s, p) => s + Number(p.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Compras</h1>
          <p className="text-muted-foreground">Total investido: {formatCurrency(total)}</p>
        </div>
        <Button onClick={() => setForm(empty())}><Plus className="mr-2 h-4 w-4" />Nova compra</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Compras registradas</CardTitle></CardHeader>
        <CardContent>
          {data.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma compra registrada.</p> : (
            <div className="divide-y">
              {data.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{p.description}</p>
                    <p className="text-sm text-muted-foreground">{[formatDate(p.purchase_date), p.supplier].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{formatCurrency(Number(p.amount))}</span>
                    <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setForm({ id: p.id, purchase_date: p.purchase_date, supplier: p.supplier ?? "", description: p.description, amount: String(p.amount), notes: p.notes ?? "" })}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => confirm("Excluir esta compra?") && remove.mutate({ data: { id: p.id } })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? "Editar compra" : "Nova compra"}</DialogTitle></DialogHeader>
          {form && (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate({ data: { ...form, amount: Number(form.amount || 0) } }); }}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="pd">Data</Label><Input id="pd" type="date" required value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} /></div>
                <div className="space-y-2">
                  <Label htmlFor="sup">Fornecedor</Label>
                  <Select value={form.supplier || undefined} onValueChange={(v) => setForm({ ...form, supplier: v })}>
                    <SelectTrigger id="sup"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{SUPPLIERS.map((s) => <SelectItem key={s.value} value={s.value}>{s.value}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2"><Label htmlFor="desc">Descrição *</Label><Input id="desc" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="amt">Valor total (R$)</Label><Input id="amt" type="number" min="0" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="notes">Observações</Label><Input id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <Button type="submit" className="w-full" disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar compra"}</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
