import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, CalendarClock, MessageSquarePlus, Trash2, UserCog, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  addCustomerContact,
  addCustomerInteraction,
  addCustomerNextAction,
  changeCustomerOwner,
  deleteCustomerContact,
  getCustomerDetail,
  updateCustomer,
  updateCustomerNextActionStatus,
} from "@/lib/customers.functions";
import {
  COMPANY_SIZES,
  CUSTOMER_SEGMENTS,
  INTERACTION_KINDS,
  LEAD_STAGES,
  ORDER_STATUS_LABELS,
  QUOTE_STATUS_LABELS,
  formatCurrency,
  formatDate,
} from "@/lib/commercial-constants";

const customerQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["customers", id],
    queryFn: () => getCustomerDetail({ data: { id } }),
  });

export const Route = createFileRoute("/_authenticated/clientes/$id")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(customerQueryOptions(params.id)),
  component: CustomerDetailPage,
  head: () => ({
    meta: [
      { title: "Ficha do Cliente - Plataforma Comercial" },
      {
        name: "description",
        content:
          "Cadastro, contatos, oportunidades, próximas ações e histórico completo do cliente.",
      },
      { property: "og:title", content: "Ficha do Cliente" },
      { property: "og:description", content: "Visão 360º operacional do cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const stageLabel = (stage: string) =>
  LEAD_STAGES.find((s) => s.value === stage)?.label ?? stage;

function CustomerDetailPage() {
  const { id } = useParams({ from: "/_authenticated/clientes/$id" });
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(customerQueryOptions(id));
  const c = data.customer;

  const [form, setForm] = useState({
    name: c.name ?? "",
    company_name: c.company_name ?? "",
    document: c.document ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    address: c.address ?? "",
    city: c.city ?? "",
    state: c.state ?? "",
    segment: c.segment ?? "",
    company_size: c.company_size ?? "",
    region: c.region ?? "",
    notes: c.notes ?? "",
  });
  const [interaction, setInteraction] = useState({ kind: "nota", content: "" });
  const [newOwner, setNewOwner] = useState("");
  const [contact, setContact] = useState({
    name: "",
    role: "",
    email: "",
    phone: "",
    is_primary: false,
    notes: "",
  });
  const [action, setAction] = useState({
    title: "",
    description: "",
    due_date: "",
    assigned_to: "",
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["customers"] });
  const onError = (e: Error) => toast.error(e.message);

  const saveMutation = useMutation({
    mutationFn: updateCustomer,
    onSuccess: () => {
      toast.success("Cadastro atualizado");
      invalidate();
    },
    onError,
  });

  const interactionMutation = useMutation({
    mutationFn: addCustomerInteraction,
    onSuccess: () => {
      toast.success("Interação registrada");
      setInteraction({ kind: "nota", content: "" });
      invalidate();
    },
    onError,
  });

  const ownerMutation = useMutation({
    mutationFn: changeCustomerOwner,
    onSuccess: () => {
      toast.success("Responsável alterado");
      setNewOwner("");
      invalidate();
    },
    onError,
  });

  const contactMutation = useMutation({
    mutationFn: addCustomerContact,
    onSuccess: () => {
      toast.success("Contato adicionado");
      setContact({ name: "", role: "", email: "", phone: "", is_primary: false, notes: "" });
      invalidate();
    },
    onError,
  });

  const removeContactMutation = useMutation({
    mutationFn: deleteCustomerContact,
    onSuccess: () => {
      toast.success("Contato removido");
      invalidate();
    },
    onError,
  });

  const actionMutation = useMutation({
    mutationFn: addCustomerNextAction,
    onSuccess: () => {
      toast.success("Ação agendada");
      setAction({ title: "", description: "", due_date: "", assigned_to: "" });
      invalidate();
    },
    onError,
  });

  const actionStatusMutation = useMutation({
    mutationFn: updateCustomerNextActionStatus,
    onSuccess: () => {
      toast.success("Ação atualizada");
      invalidate();
    },
    onError,
  });

  const pendingActions = data.nextActions.filter((a) => a.status === "pendente");
  const openOpportunities = data.opportunities.filter(
    (o) => o.stage !== "ganho" && o.stage !== "perdido",
  );

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild>
        <Link to="/clientes">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{c.company_name || c.name}</h1>
          <p className="text-muted-foreground">
            Responsável: {data.ownerName}
            {c.document ? ` · ${c.document}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.segment ? <Badge variant="secondary">{c.segment}</Badge> : null}
          {c.company_size ? <Badge variant="outline">{c.company_size}</Badge> : null}
          {c.region ? <Badge variant="outline">{c.region}</Badge> : null}
        </div>
      </div>

      <Tabs defaultValue="visao">
        <TabsList className="flex-wrap">
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
          <TabsTrigger value="contatos">Contatos</TabsTrigger>
          <TabsTrigger value="oportunidades">Oportunidades</TabsTrigger>
          <TabsTrigger value="acoes">Próximas ações</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="responsavel">Responsável</TabsTrigger>
        </TabsList>

        <TabsContent value="visao" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarClock className="h-4 w-4" />
                  Próximas ações pendentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingActions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma ação agendada.</p>
                ) : (
                  <div className="divide-y">
                    {pendingActions.slice(0, 5).map((a) => (
                      <div key={a.id} className="flex items-center justify-between py-2 text-sm">
                        <span>{a.title}</span>
                        <span className="text-muted-foreground">{formatDate(a.due_date)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Oportunidades em aberto</CardTitle>
              </CardHeader>
              <CardContent>
                {openOpportunities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma oportunidade aberta.</p>
                ) : (
                  <div className="divide-y">
                    {openOpportunities.slice(0, 5).map((o) => (
                      <div key={o.id} className="flex items-center justify-between py-2 text-sm">
                        <span>{o.name}</span>
                        <span className="text-muted-foreground">{stageLabel(o.stage)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Últimos pedidos</CardTitle>
              </CardHeader>
              <CardContent>
                {data.orders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum pedido registrado.</p>
                ) : (
                  <div className="divide-y">
                    {data.orders.slice(0, 5).map((order) => (
                      <Link
                        key={order.id}
                        to="/pedidos/$id"
                        params={{ id: order.id }}
                        className="flex items-center justify-between py-2 text-sm hover:opacity-80"
                      >
                        <span>
                          {formatDate(order.created_at)} ·{" "}
                          {ORDER_STATUS_LABELS[order.status] ?? order.status}
                        </span>
                        <span className="font-medium">
                          {formatCurrency(Number(order.total ?? 0))}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Orçamentos</CardTitle>
              </CardHeader>
              <CardContent>
                {data.quotes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum orçamento emitido.</p>
                ) : (
                  <div className="divide-y">
                    {data.quotes.slice(0, 5).map((q) => (
                      <Link
                        key={q.id}
                        to="/orcamentos/$id"
                        params={{ id: q.id }}
                        className="flex items-center justify-between py-2 text-sm hover:opacity-80"
                      >
                        <span>
                          #{q.number} · {QUOTE_STATUS_LABELS[q.status] ?? q.status}
                        </span>
                        <span className="font-medium">{formatCurrency(Number(q.total ?? 0))}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cadastro" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Dados cadastrais</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveMutation.mutate({ data: { id, ...form } });
                }}
              >
                {[
                  ["name", "Nome *"],
                  ["company_name", "Razão social"],
                  ["document", "CNPJ / CPF"],
                  ["email", "E-mail"],
                  ["phone", "Telefone"],
                  ["address", "Endereço"],
                  ["city", "Cidade"],
                  ["state", "Estado"],
                  ["region", "Região"],
                ].map(([key, label]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={key}>{label}</Label>
                    <Input
                      id={key}
                      value={form[key as keyof typeof form] as string}
                      onChange={(e) => setForm({ ...form, [key!]: e.target.value })}
                      required={key === "name"}
                    />
                  </div>
                ))}
                <div className="space-y-2">
                  <Label>Segmento</Label>
                  <Select
                    value={form.segment}
                    onValueChange={(value) => setForm({ ...form, segment: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {CUSTOMER_SEGMENTS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Porte</Label>
                  <Select
                    value={form.company_size}
                    onValueChange={(value) => setForm({ ...form, company_size: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPANY_SIZES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
                <Button type="submit" disabled={saveMutation.isPending} className="sm:col-span-2">
                  {saveMutation.isPending ? "Salvando..." : "Salvar alterações"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contatos" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Novo contato
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  contactMutation.mutate({ data: { customer_id: id, ...contact } });
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="contact-name">Nome *</Label>
                  <Input
                    id="contact-name"
                    value={contact.name}
                    onChange={(e) => setContact({ ...contact, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-role">Cargo</Label>
                  <Input
                    id="contact-role"
                    value={contact.role}
                    onChange={(e) => setContact({ ...contact, role: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-email">E-mail</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    value={contact.email}
                    onChange={(e) => setContact({ ...contact, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-phone">Telefone</Label>
                  <Input
                    id="contact-phone"
                    value={contact.phone}
                    onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <Checkbox
                    id="contact-primary"
                    checked={contact.is_primary}
                    onCheckedChange={(v) => setContact({ ...contact, is_primary: v === true })}
                  />
                  <Label htmlFor="contact-primary">Contato principal</Label>
                </div>
                <Button
                  type="submit"
                  disabled={contactMutation.isPending}
                  className="sm:col-span-2"
                >
                  Adicionar contato
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contatos cadastrados</CardTitle>
            </CardHeader>
            <CardContent>
              {data.contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum contato cadastrado.</p>
              ) : (
                <div className="divide-y">
                  {data.contacts.map((ct) => (
                    <div key={ct.id} className="flex items-start justify-between gap-4 py-3">
                      <div>
                        <p className="font-medium">
                          {ct.name}
                          {ct.is_primary ? (
                            <Badge className="ml-2" variant="secondary">
                              Principal
                            </Badge>
                          ) : null}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {[ct.role, ct.email, ct.phone].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeContactMutation.mutate({ data: { id: ct.id } })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="oportunidades" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Oportunidades vinculadas</CardTitle>
            </CardHeader>
            <CardContent>
              {data.opportunities.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma oportunidade vinculada a este cliente.
                </p>
              ) : (
                <div className="divide-y">
                  {data.opportunities.map((o) => (
                    <div key={o.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium">{o.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {stageLabel(o.stage)} · previsão {formatDate(o.expected_close_date)}
                          {o.loss_reason ? ` · perda: ${o.loss_reason}` : ""}
                        </p>
                      </div>
                      <span className="font-semibold">
                        {formatCurrency(Number(o.estimated_value ?? 0))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="acoes" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Agendar próxima ação</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  actionMutation.mutate({ data: { customer_id: id, ...action } });
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="action-title">Ação *</Label>
                  <Input
                    id="action-title"
                    value={action.title}
                    onChange={(e) => setAction({ ...action, title: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="action-date">Data</Label>
                  <Input
                    id="action-date"
                    type="date"
                    value={action.due_date}
                    onChange={(e) => setAction({ ...action, due_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Responsável</Label>
                  <Select
                    value={action.assigned_to}
                    onValueChange={(value) => setAction({ ...action, assigned_to: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Eu mesmo" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.sellers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.full_name || s.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="action-desc">Detalhes</Label>
                  <Textarea
                    id="action-desc"
                    value={action.description}
                    onChange={(e) => setAction({ ...action, description: e.target.value })}
                  />
                </div>
                <Button type="submit" disabled={actionMutation.isPending} className="sm:col-span-2">
                  Agendar
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Agenda do cliente</CardTitle>
            </CardHeader>
            <CardContent>
              {data.nextActions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma ação registrada.</p>
              ) : (
                <div className="divide-y">
                  {data.nextActions.map((a) => (
                    <div key={a.id} className="flex items-start justify-between gap-4 py-3">
                      <div>
                        <p className="font-medium">{a.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(a.due_date)} · {a.assigned_to_name ?? "—"} · {a.status}
                        </p>
                        {a.description ? <p className="text-sm">{a.description}</p> : null}
                      </div>
                      {a.status === "pendente" ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              actionStatusMutation.mutate({
                                data: { id: a.id, status: "concluida" },
                              })
                            }
                          >
                            Concluir
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              actionStatusMutation.mutate({
                                data: { id: a.id, status: "cancelada" },
                              })
                            }
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquarePlus className="h-4 w-4" />
                Registrar interação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  interactionMutation.mutate({ data: { customer_id: id, ...interaction } });
                }}
              >
                <Select
                  value={interaction.kind}
                  onValueChange={(value) => setInteraction({ ...interaction, kind: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERACTION_KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {k}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  placeholder="Descreva a interação"
                  value={interaction.content}
                  onChange={(e) => setInteraction({ ...interaction, content: e.target.value })}
                  required
                />
                <Button type="submit" disabled={interactionMutation.isPending}>
                  Registrar
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Linha do tempo</CardTitle>
            </CardHeader>
            <CardContent>
              {data.timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nada registrado ainda.</p>
              ) : (
                <div className="space-y-3">
                  {data.timeline.map((t) => (
                    <div key={t.id} className="border-l-2 border-primary/40 pl-3">
                      <p className="text-sm font-medium">{t.title}</p>
                      <p className="text-sm">{t.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(t.date).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="responsavel" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-4 w-4" />
                Alterar responsável
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={newOwner} onValueChange={setNewOwner}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o novo responsável" />
                </SelectTrigger>
                <SelectContent>
                  {data.sellers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name || s.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                disabled={!newOwner || ownerMutation.isPending}
                onClick={() => ownerMutation.mutate({ data: { id, owner_id: newOwner } })}
              >
                Transferir carteira
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Histórico de responsáveis</CardTitle>
            </CardHeader>
            <CardContent>
              {data.ownerHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma transferência registrada.</p>
              ) : (
                <div className="space-y-3">
                  {data.ownerHistory.map((h) => (
                    <div key={h.id} className="border-l-2 border-primary/40 pl-3 text-sm">
                      <p className="font-medium">
                        {h.previous_owner_name ?? "—"} → {h.new_owner_name ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {h.changed_by_name} · {new Date(h.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
