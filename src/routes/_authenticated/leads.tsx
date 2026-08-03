import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, ArrowRight, UserPlus, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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
import { convertLeadToOpportunity } from "@/lib/opportunities.functions";
import {
  convertLeadToCustomer,
  createLead,
  getPipelineMetrics,
  listLeads,
  moveLeadStage,
  updateLead,
} from "@/lib/leads.functions";
import {
  BRAZIL_STATES,
  CUSTOMER_SEGMENTS,
  LEAD_STAGES,
  LOSS_REASONS,
  STAGE_PROBABILITY,
  formatCurrency,
} from "@/lib/commercial-constants";
import { LocationAnalytics } from "@/components/analytics/location-analytics";
import { Checkbox } from "@/components/ui/checkbox";
import { OptionsMenu, bulkDeleteToastMessage, useBulkSelection } from "@/components/bulk-select";
import { bulkDeleteLeads } from "@/lib/bulk-delete.functions";

import {
  CEP_ERROR,
  PHONE_ERROR,
  isValidCep,
  isValidPhone,
  maskCep,
  maskPhone,
  validateContactFields,
} from "@/lib/masks";

/** Etapas selecionáveis manualmente (a conversão em cliente é feita pelo botão). */
const SELECTABLE_STAGES = LEAD_STAGES.filter((s) => s.value !== "convertido");

const leadsQueryOptions = () =>
  queryOptions({ queryKey: ["leads"], queryFn: () => listLeads() });

const pipelineQueryOptions = () =>
  queryOptions({ queryKey: ["leads", "pipeline"], queryFn: () => getPipelineMetrics() });

export const Route = createFileRoute("/_authenticated/leads")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(leadsQueryOptions());
    context.queryClient.ensureQueryData(pipelineQueryOptions());
  },
  component: LeadsPage,
  head: () => ({
    meta: [
      { title: "Pipeline de Oportunidades - Plataforma Comercial" },
      {
        name: "description",
        content:
          "Funil de leads em kanban com previsão de fechamento, motivos de perda e conversão em clientes.",
      },
      { property: "og:title", content: "Pipeline de Oportunidades" },
      { property: "og:description", content: "Funil comercial de leads a clientes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const emptyLead = {
  name: "",
  company: "",
  email: "",
  phone: "",
  city: "",
  state: "",
  postal_code: "",
  cnpj: "",
  segment: "",
  source: "",
  stage: "novo",
  estimated_value: 0,
  probability: 0,
  next_action: "",
  next_action_date: "",
  expected_close_date: "",
  notes: "",
};

function LeadsPage() {
  const queryClient = useQueryClient();
  const { data: leads } = useSuspenseQuery(leadsQueryOptions());
  const { data: pipeline } = useSuspenseQuery(pipelineQueryOptions());
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyLead);
  const [massOpen, setMassOpen] = useState(false);
  const [massStage, setMassStage] = useState("");
  const [lossTarget, setLossTarget] = useState<{ id: string; name: string } | null>(null);
  const [loss, setLoss] = useState({ loss_reason: "", loss_detail: "" });


  const selection = useBulkSelection(leads.map((l) => l.id));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["leads"] });

  const updateMutation = useMutation({
    mutationFn: updateLead,
    onSuccess: () => {
      toast.success("Lead atualizado");
      setOpen(false);
      setEditingId(null);
      setForm(emptyLead);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const massStageMutation = useMutation({
    mutationFn: async (stage: string) => {
      for (const id of selection.selected) {
        await updateLead({ data: { id, stage } });
      }
    },
    onSuccess: () => {
      toast.success("Etapa atualizada nos leads selecionados.");
      setMassOpen(false);
      setMassStage("");
      selection.clear();
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleEdit = () => {
    if (selection.selected.length === 1) {
      const lead = leads.find((l) => l.id === selection.selected[0]);
      if (!lead) return;
      setForm({
        ...emptyLead,
        name: lead.name ?? "",
        company: lead.company ?? "",
        email: lead.email ?? "",
        phone: lead.phone ?? "",
        city: lead.city ?? "",
        state: lead.state ?? "",
        postal_code: lead.postal_code ?? "",
        cnpj: lead.cnpj ?? "",
        segment: lead.segment ?? "",
        source: lead.source ?? "",
        stage: lead.stage ?? "novo",
        estimated_value: Number(lead.estimated_value ?? 0),
        probability: Number(lead.probability ?? 0),
        next_action: lead.next_action ?? "",
        next_action_date: lead.next_action_date ?? "",
        expected_close_date: lead.expected_close_date ?? "",
        notes: lead.notes ?? "",
      });
      setEditingId(lead.id);
      setOpen(true);
      return;
    }
    setMassOpen(true);
  };


  const removeMany = useMutation({
    mutationFn: bulkDeleteLeads,
    onSuccess: (result) => {
      selection.clear();
      invalidate();
      toast.success(bulkDeleteToastMessage(result));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createMutation = useMutation({
    mutationFn: createLead,
    onSuccess: () => {
      toast.success("Lead criado");
      setForm(emptyLead);
      setOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveMutation = useMutation({
    mutationFn: moveLeadStage,
    onSuccess: () => {
      setLossTarget(null);
      setLoss({ loss_reason: "", loss_detail: "" });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const opportunityMutation = useMutation({
    mutationFn: convertLeadToOpportunity,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      toast.success(
        res.alreadyExists ? "Este lead já possui oportunidade." : "Oportunidade criada a partir do lead.",
      );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao converter."),
  });

  const convertMutation = useMutation({
    mutationFn: convertLeadToCustomer,
    onSuccess: () => {
      toast.success("Lead convertido em cliente");
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleStageChange = (lead: { id: string; name: string }, stage: string) => {
    if (stage === "perdido") {
      setLossTarget(lead);
      return;
    }
    moveMutation.mutate({ data: { id: lead.id, stage } });
  };

  const totalValue = leads.reduce((sum, l) => sum + Number(l.estimated_value ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pipeline de Oportunidades</h1>
          <p className="text-muted-foreground">
            {leads.length} registros no funil · {formatCurrency(totalValue)} em oportunidades
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) {
              setEditingId(null);
              setForm(emptyLead);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo lead
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar lead" : "Novo lead"}</DialogTitle>
            </DialogHeader>
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const invalid = validateContactFields(form);
                if (invalid) {
                  toast.error(invalid);
                  return;
                }
                if (editingId) {
                  updateMutation.mutate({ data: { id: editingId, ...form } });
                  return;
                }
                createMutation.mutate({ data: form });
              }}
            >

              {[
                ["name", "Nome *"],
                ["company", "Empresa"],
                ["email", "E-mail"],
                ["phone", "Telefone"],
                ["city", "Cidade"],
                ["postal_code", "CEP"],
                ["cnpj", "CNPJ"],
                ["source", "Origem"],
                ["next_action", "Próxima ação"],
              ].map(([key, label]) => {
                const value = String(form[key as keyof typeof form] ?? "");
                const invalid =
                  (key === "phone" && !!value && !isValidPhone(value)) ||
                  (key === "postal_code" && !!value && !isValidCep(value));
                return (
                  <div key={key} className="space-y-1">
                    <Label htmlFor={key}>{label}</Label>
                    <Input
                      id={key}
                      value={value}
                      placeholder={
                        key === "phone"
                          ? "(00) 00000-0000"
                          : key === "postal_code"
                            ? "00000-000"
                            : undefined
                      }
                      inputMode={
                        key === "phone" ? "tel" : key === "postal_code" ? "numeric" : undefined
                      }
                      aria-invalid={invalid}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const next =
                          key === "phone"
                            ? maskPhone(raw)
                            : key === "postal_code"
                              ? maskCep(raw)
                              : raw;
                        setForm({ ...form, [key!]: next });
                      }}
                      required={key === "name"}
                    />
                    {invalid && (
                      <p className="text-xs text-destructive">
                        {key === "phone" ? PHONE_ERROR : CEP_ERROR}
                      </p>
                    )}
                  </div>
                );
              })}
              <div className="space-y-1">
                <Label htmlFor="estimated_value">Valor estimado</Label>
                <Input
                  id="estimated_value"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.estimated_value}
                  onChange={(e) =>
                    setForm({ ...form, estimated_value: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="probability">Probabilidade (%)</Label>
                <Input
                  id="probability"
                  type="number"
                  value={STAGE_PROBABILITY[form.stage] ?? 0}
                  readOnly
                  aria-describedby="probability-help"
                />
                <p id="probability-help" className="text-xs text-muted-foreground">
                  Calculada automaticamente pela etapa do funil.
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="next_action_date">Data da próxima ação</Label>
                <Input
                  id="next_action_date"
                  type="date"
                  value={form.next_action_date}
                  onChange={(e) => setForm({ ...form, next_action_date: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="expected_close_date">Previsão de fechamento</Label>
                <Input
                  id="expected_close_date"
                  type="date"
                  value={form.expected_close_date}
                  onChange={(e) => setForm({ ...form, expected_close_date: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Estado</Label>
                <Select
                  value={form.state || undefined}
                  onValueChange={(value) => setForm({ ...form, state: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRAZIL_STATES.map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Segmento</Label>
                <Select
                  value={form.segment || undefined}
                  onValueChange={(value) => setForm({ ...form, segment: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOMER_SEGMENTS.map((seg) => (
                      <SelectItem key={seg} value={seg}>
                        {seg}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Estágio</Label>
                <Select
                  value={form.stage}
                  onValueChange={(value) => setForm({ ...form, stage: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SELECTABLE_STAGES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <Button
                type="submit"
                className="sm:col-span-2"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Salvando..."
                  : editingId
                    ? "Salvar alterações"
                    : "Criar lead"}
              </Button>

            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Oportunidades abertas", value: String(pipeline.openCount) },
          { label: "Valor em aberto", value: formatCurrency(pipeline.openValue) },
          { label: "Previsão ponderada", value: formatCurrency(pipeline.forecast) },
          {
            label: "Taxa de conversão",
            value: `${pipeline.conversionRate.toFixed(1)}%`,
            hint: `Ciclo médio ${pipeline.averageCycleDays.toFixed(0)} dias`,
          },
        ].map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{card.value}</p>
              {card.hint && <p className="text-xs text-muted-foreground">{card.hint}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {pipeline.lossReasons.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Principais motivos de perda</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {pipeline.lossReasons.map((r) => (
              <Badge key={r.reason} variant="outline">
                {r.reason} · {r.count}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <LocationAnalytics />

      <OptionsMenu
        total={leads.length}
        count={selection.selected.length}
        onSelectAll={selection.selectAll}
        onClearAll={selection.clear}
        onEdit={handleEdit}
        onDelete={() => removeMany.mutate({ data: { ids: selection.selected } })}
        isPending={removeMany.isPending}
        entityLabel="lead(s)"
        description="Os leads selecionados e seu histórico de etapas serão removidos permanentemente."
      />

      <Dialog open={massOpen} onOpenChange={setMassOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar {selection.selected.length} leads</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Nova etapa do funil</Label>
            <Select value={massStage} onValueChange={setMassStage}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a etapa" />
              </SelectTrigger>
              <SelectContent>
                {SELECTABLE_STAGES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="w-full"
              disabled={!massStage || massStageMutation.isPending}
              onClick={() => massStageMutation.mutate(massStage)}
            >
              {massStageMutation.isPending ? "Aplicando..." : "Aplicar aos selecionados"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>



      <div className="flex gap-4 overflow-x-auto pb-4">
        {LEAD_STAGES.map((stage) => {
          const stageLeads = leads.filter((l) => l.stage === stage.value);
          const stageValue = stageLeads.reduce(
            (sum, l) => sum + Number(l.estimated_value ?? 0),
            0,
          );
          return (
            <Card key={stage.value} className="w-72 shrink-0">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span>{stage.label}</span>
                  <Badge variant="secondary">{stageLeads.length}</Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">{formatCurrency(stageValue)}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {stageLeads.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum lead.</p>
                )}
                {stageLeads.map((lead) => (
                  <div key={lead.id} className="rounded-lg border bg-card p-3 shadow-sm">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={selection.isSelected(lead.id)}
                        onCheckedChange={() => selection.toggle(lead.id)}
                        aria-label={`Selecionar ${lead.name}`}
                      />
                      <p className="text-sm font-medium">{lead.name}</p>
                    </div>
                    {lead.company && (
                      <p className="text-xs text-muted-foreground">{lead.company}</p>
                    )}
                    {(lead.city || lead.state) && (
                      <p className="text-xs text-muted-foreground">
                        {[lead.city, lead.state].filter(Boolean).join(" / ")}
                        {lead.postal_code ? ` · ${lead.postal_code}` : ""}
                      </p>
                    )}
                    <p className="mt-1 text-xs font-medium">
                      {formatCurrency(Number(lead.estimated_value ?? 0))} · {lead.probability}%
                    </p>
                    {lead.expected_close_date && (
                      <p className="text-xs text-muted-foreground">
                        Previsão:{" "}
                        {new Date(lead.expected_close_date).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                    {lead.loss_reason && (
                      <Badge variant="destructive" className="mt-1 text-[10px]">
                        {lead.loss_reason}
                      </Badge>
                    )}
                    {lead.next_action && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {lead.next_action}
                        {lead.next_action_date
                          ? ` (${new Date(lead.next_action_date).toLocaleDateString("pt-BR")})`
                          : ""}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {lead.converted_customer_id ? (
                        <Badge className="text-[10px]">
                          Convertido em cliente
                          {lead.converted_at
                            ? ` em ${new Date(lead.converted_at).toLocaleDateString("pt-BR")}`
                            : ""}
                        </Badge>
                      ) : (
                        <Select
                          value={lead.stage}
                          onValueChange={(value) =>
                            handleStageChange({ id: lead.id, name: lead.name }, value)
                          }
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <ArrowRight className="mr-1 h-3 w-3" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SELECTABLE_STAGES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {!lead.converted_customer_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-full text-xs"
                          disabled={convertMutation.isPending}
                          onClick={() => convertMutation.mutate({ data: { id: lead.id } })}
                        >
                          <UserPlus className="mr-1 h-3 w-3" />
                          Converter em cliente
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-full text-xs"
                        onClick={() => opportunityMutation.mutate({ data: { lead_id: lead.id } })}
                      >
                        <Briefcase className="mr-1 h-3 w-3" />
                        Gerar oportunidade
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={lossTarget !== null} onOpenChange={(o) => !o && setLossTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar {lossTarget?.name} como perdido</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!lossTarget) return;
              moveMutation.mutate({
                data: { id: lossTarget.id, stage: "perdido", ...loss },
              });
            }}
          >
            <div className="space-y-1">
              <Label>Motivo da perda *</Label>
              <Select
                value={loss.loss_reason}
                onValueChange={(value) => setLoss({ ...loss, loss_reason: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {LOSS_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="loss_detail">Detalhamento</Label>
              <Textarea
                id="loss_detail"
                value={loss.loss_detail}
                onChange={(e) => setLoss({ ...loss, loss_detail: e.target.value })}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={!loss.loss_reason || moveMutation.isPending}
            >
              {moveMutation.isPending ? "Salvando..." : "Confirmar perda"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
