import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { OptionsMenu, useBulkSelection } from "@/components/bulk-select";
import { RecordSearch, useRecordSearch } from "@/components/record-search";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listOpportunities,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
} from "@/lib/opportunities.functions";
import { listCustomers } from "@/lib/customers.functions";
import { listProducts } from "@/lib/products.functions";
import {
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_STATUS_LABELS,
  formatCurrency,
  formatDate,
} from "@/lib/commercial-constants";

const opportunitiesQueryOptions = () =>
  queryOptions({ queryKey: ["opportunities"], queryFn: () => listOpportunities() });
const customersQueryOptions = () =>
  queryOptions({ queryKey: ["customers"], queryFn: () => listCustomers() });
const productsQueryOptions = () =>
  queryOptions({ queryKey: ["products"], queryFn: () => listProducts() });

export const Route = createFileRoute("/_authenticated/oportunidades")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(opportunitiesQueryOptions());
    context.queryClient.ensureQueryData(customersQueryOptions());
    context.queryClient.ensureQueryData(productsQueryOptions());
  },
  component: OpportunitiesPage,
  errorComponent: ({ error }) => (
    <p role="alert" className="text-sm text-destructive">
      {(error as Error).message}
    </p>
  ),
  head: () => ({
    meta: [
      { title: "Oportunidades - Nexus 360" },
      {
        name: "description",
        content: "Gerencie oportunidades comerciais, valores, probabilidade e previsão de fechamento.",
      },
      { property: "og:title", content: "Oportunidades - Nexus 360" },
      {
        property: "og:description",
        content: "Gerencie oportunidades comerciais, valores e previsão de fechamento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  aberta: "outline",
  em_negociacao: "secondary",
  ganha: "default",
  perdida: "destructive",
};

const emptyForm = {
  title: "",
  customer_id: "",
  product_id: "",
  product_description: "",
  amount: "0",
  status: "aberta" as (typeof OPPORTUNITY_STATUSES)[number]["value"],
  expected_close_date: "",
  notes: "",
};

function OpportunitiesPage() {
  const queryClient = useQueryClient();
  const { data: opportunities } = useSuspenseQuery(opportunitiesQueryOptions());
  const { data: customers } = useSuspenseQuery(customersQueryOptions());
  const { data: products } = useSuspenseQuery(productsQueryOptions());
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [massOpen, setMassOpen] = useState(false);
  const [massStatus, setMassStatus] = useState("");
  const search = useRecordSearch(opportunities, (o) => [
    o.title,
    o.opportunity_code,
    o.customers?.name,
    o.customers?.company_name,
    (o.customers as { customer_code?: string | null } | null)?.customer_code,
    (o.customers as { document?: string | null } | null)?.document,
  ]);
  const visibleOpportunities = search.results;
  const selection = useBulkSelection(visibleOpportunities.map((o) => o.id));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["opportunities"] });

  const createMutation = useMutation({
    mutationFn: createOpportunity,
    onSuccess: () => {
      invalidate();
      setForm(emptyForm);
      setOpen(false);
      toast.success("Oportunidade criada.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao criar oportunidade."),
  });

  const statusMutation = useMutation({
    mutationFn: updateOpportunity,
    onSuccess: () => {
      invalidate();
      toast.success("Status atualizado.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao atualizar."),
  });

  const updateMutation = useMutation({
    mutationFn: updateOpportunity,
    onSuccess: () => {
      invalidate();
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success("Oportunidade atualizada.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao atualizar."),
  });

  const massStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      for (const id of selection.selected) {
        await updateOpportunity({ data: { id, status: status as "aberta" } });
      }
    },
    onSuccess: () => {
      invalidate();
      setMassOpen(false);
      setMassStatus("");
      selection.clear();
      toast.success("Status atualizado nas oportunidades selecionadas.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao atualizar."),
  });

  const removeMany = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await deleteOpportunity({ data: { id } });
      }
      return ids.length;
    },
    onSuccess: (count) => {
      invalidate();
      selection.clear();
      toast.success(`${count} registro(s) excluído(s).`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao excluir."),
  });

  const openEditOpportunity = (id: string) => {
    {
      const opp = opportunities.find((o) => o.id === id);
      if (!opp) return;
      setForm({
        title: opp.title ?? "",
        customer_id: opp.customer_id ?? "",
        product_id: opp.product_id ?? "",
        product_description: opp.product_description ?? "",
        amount: String(opp.amount ?? 0),
        status: (opp.status ?? "aberta") as typeof emptyForm.status,
        expected_close_date: opp.expected_close_date ?? "",
        notes: opp.notes ?? "",
      });
      setEditingId(opp.id);
      setOpen(true);
    }
  };

  const handleEdit = () => {
    if (selection.selected.length === 1) {
      openEditOpportunity(selection.selected[0]!);
      return;
    }
    setMassOpen(true);
  };


  const openOnes = opportunities.filter((o) => o.status === "aberta" || o.status === "em_negociacao");
  const totalOpen = openOnes.reduce((s, o) => s + Number(o.amount ?? 0), 0);
  const forecast = openOnes.reduce(
    (s, o) => s + (Number(o.amount ?? 0) * Number(o.probability ?? 0)) / 100,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Oportunidades</h1>
          <p className="text-muted-foreground">
            Negociações em andamento com valor, probabilidade e previsão.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) {
              setEditingId(null);
              setForm(emptyForm);
            }
          }}
        >

          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova oportunidade
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar oportunidade" : "Nova oportunidade"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select
                  value={form.customer_id || undefined}
                  onValueChange={(v) => setForm({ ...form, customer_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.company_name || c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Produto/serviço</Label>
                <Select
                  value={form.product_id || undefined}
                  onValueChange={(v) => setForm({ ...form, product_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="amount">Valor estimado</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expected">Previsão de fechamento</Label>
                  <Input
                    id="expected"
                    type="date"
                    value={form.expected_close_date}
                    onChange={(e) => setForm({ ...form, expected_close_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPPORTUNITY_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                disabled={
                  !form.title.trim() || createMutation.isPending || updateMutation.isPending
                }
                onClick={() =>
                  editingId
                    ? updateMutation.mutate({ data: { id: editingId, ...form } })
                    : createMutation.mutate({ data: form })
                }
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Salvando..."
                  : editingId
                    ? "Salvar alterações"
                    : "Criar"}
              </Button>
            </DialogFooter>

          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em aberto</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{openOnes.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Valor em negociação
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{formatCurrency(totalOpen)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Previsão ponderada
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{formatCurrency(forecast)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Lista de oportunidades</CardTitle>
          <OptionsMenu
            total={visibleOpportunities.length}
            count={selection.selected.length}
            onSelectAll={selection.selectAll}
            onClearAll={selection.clear}
            onEdit={handleEdit}
            onDelete={() => removeMany.mutate(selection.selected)}
            isPending={removeMany.isPending}
            entityLabel="oportunidade(s)"
            description="As oportunidades selecionadas serão removidas permanentemente."
          />
          </div>
          <RecordSearch
            query={search.query}
            onQueryChange={search.setQuery}
            suggestions={visibleOpportunities.map((o) => ({
              id: o.id,
              label: o.customers?.company_name || o.customers?.name || o.title,
              sublabel: [o.opportunity_code, o.title].filter(Boolean).join(" · "),
            }))}
            onSelect={openEditOpportunity}
          />
        </CardHeader>
        <CardContent>
          {visibleOpportunities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {search.isSearching ? "Nenhum resultado para a pesquisa." : "Nenhuma oportunidade registrada."}
            </p>
          ) : (
            <div className="divide-y">
              {visibleOpportunities.map((o) => (
                <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selection.isSelected(o.id)}
                      onCheckedChange={() => selection.toggle(o.id)}
                      aria-label={`Selecionar ${o.title}`}
                    />
                    <div>
                      <p className="font-medium">{o.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {o.customers?.company_name ||
                          o.customers?.name ||
                          o.leads?.name ||
                          "Sem cliente"}
                        {o.products?.name ? ` · ${o.products.name}` : ""} · Previsão{" "}
                        {formatDate(o.expected_close_date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{formatCurrency(Number(o.amount ?? 0))}</span>
                    <Badge variant={statusVariants[o.status] ?? "outline"}>
                      {OPPORTUNITY_STATUS_LABELS[o.status] ?? o.status} · {o.probability ?? 0}%
                    </Badge>
                    <Select
                      value={o.status}
                      onValueChange={(v) =>
                        statusMutation.mutate({ data: { id: o.id, status: v as "aberta" } })
                      }
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPPORTUNITY_STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>

          )}
        </CardContent>
      </Card>

      <Dialog open={massOpen} onOpenChange={setMassOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar {selection.selected.length} oportunidades</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Novo status</Label>
            <Select value={massStatus} onValueChange={setMassStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                {OPPORTUNITY_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="w-full"
              disabled={!massStatus || massStatusMutation.isPending}
              onClick={() => massStatusMutation.mutate(massStatus)}
            >
              {massStatusMutation.isPending ? "Aplicando..." : "Aplicar aos selecionados"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>

  );
}
