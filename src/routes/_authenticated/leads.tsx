import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, ArrowRight, UserPlus } from "lucide-react";
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
import {
  convertLeadToCustomer,
  createLead,
  listLeads,
  moveLeadStage,
} from "@/lib/leads.functions";
import { LEAD_STAGES, formatCurrency } from "@/lib/commercial-constants";

const leadsQueryOptions = () =>
  queryOptions({ queryKey: ["leads"], queryFn: () => listLeads() });

export const Route = createFileRoute("/_authenticated/leads")({
  loader: ({ context }) => context.queryClient.ensureQueryData(leadsQueryOptions()),
  component: LeadsPage,
  head: () => ({
    meta: [
      { title: "Leads - Plataforma Comercial" },
      {
        name: "description",
        content: "Funil de leads em kanban com estágios, valor estimado e conversão em clientes.",
      },
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
  source: "",
  stage: "novo",
  estimated_value: 0,
  probability: 0,
  next_action: "",
  next_action_date: "",
  notes: "",
};

function LeadsPage() {
  const queryClient = useQueryClient();
  const { data: leads } = useSuspenseQuery(leadsQueryOptions());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyLead);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["leads"] });

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
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
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

  const totalValue = leads.reduce((sum, l) => sum + Number(l.estimated_value ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground">
            {leads.length} leads no funil · {formatCurrency(totalValue)} em oportunidades
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo lead
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo lead</DialogTitle>
            </DialogHeader>
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate({ data: form });
              }}
            >
              {[
                ["name", "Nome *"],
                ["company", "Empresa"],
                ["email", "E-mail"],
                ["phone", "Telefone"],
                ["city", "Cidade"],
                ["state", "Estado"],
                ["source", "Origem"],
                ["next_action", "Próxima ação"],
              ].map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    value={String(form[key as keyof typeof form] ?? "")}
                    onChange={(e) => setForm({ ...form, [key!]: e.target.value })}
                    required={key === "name"}
                  />
                </div>
              ))}
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
                  min={0}
                  max={100}
                  value={form.probability}
                  onChange={(e) => setForm({ ...form, probability: Number(e.target.value) })}
                />
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
                <Label>Estágio</Label>
                <Select
                  value={form.stage}
                  onValueChange={(value) => setForm({ ...form, stage: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STAGES.map((s) => (
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
              <Button type="submit" className="sm:col-span-2" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Salvando..." : "Criar lead"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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
                    <p className="text-sm font-medium">{lead.name}</p>
                    {lead.company && (
                      <p className="text-xs text-muted-foreground">{lead.company}</p>
                    )}
                    <p className="mt-1 text-xs font-medium">
                      {formatCurrency(Number(lead.estimated_value ?? 0))} · {lead.probability}%
                    </p>
                    {lead.next_action && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {lead.next_action}
                        {lead.next_action_date
                          ? ` (${new Date(lead.next_action_date).toLocaleDateString("pt-BR")})`
                          : ""}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Select
                        value={lead.stage}
                        onValueChange={(value) =>
                          moveMutation.mutate({ data: { id: lead.id, stage: value } })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <ArrowRight className="mr-1 h-3 w-3" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_STAGES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!lead.converted_customer_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-full text-xs"
                          onClick={() => convertMutation.mutate({ data: { id: lead.id } })}
                        >
                          <UserPlus className="mr-1 h-3 w-3" />
                          Converter em cliente
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
