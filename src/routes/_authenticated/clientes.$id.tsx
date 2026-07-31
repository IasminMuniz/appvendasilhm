import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, MessageSquarePlus, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  addCustomerInteraction,
  changeCustomerOwner,
  getCustomerDetail,
  updateCustomer,
} from "@/lib/customers.functions";
import {
  HEALTH_LABELS,
  ORDER_STATUS_LABELS,
  formatCurrency,
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
      { title: "Ficha do Cliente - Vendas Comercial" },
      {
        name: "description",
        content: "Histórico de compras, indicadores e relacionamento completo do cliente.",
      },
    ],
  }),
});

const healthVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  saudavel: "default",
  atencao: "secondary",
  risco: "destructive",
  inativo: "outline",
};

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
    notes: c.notes ?? "",
  });
  const [interaction, setInteraction] = useState({ kind: "nota", content: "" });
  const [newOwner, setNewOwner] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["customers"] });
  };

  const saveMutation = useMutation({
    mutationFn: updateCustomer,
    onSuccess: () => {
      toast.success("Cadastro atualizado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const interactionMutation = useMutation({
    mutationFn: addCustomerInteraction,
    onSuccess: () => {
      toast.success("Interação registrada");
      setInteraction({ kind: "nota", content: "" });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ownerMutation = useMutation({
    mutationFn: changeCustomerOwner,
    onSuccess: () => {
      toast.success("Responsável alterado");
      setNewOwner("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const m = data.metrics;

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
        <Badge variant={healthVariant[m.health]}>{HEALTH_LABELS[m.health]}</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total comprado", value: formatCurrency(m.totalRevenue) },
          { label: "Pedidos", value: String(m.ordersCount) },
          { label: "Ticket médio", value: formatCurrency(m.averageTicket) },
          { label: "Média mensal", value: formatCurrency(m.monthlyAverage) },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {item.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="resumo">
        <TabsList className="flex-wrap">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
          <TabsTrigger value="relacionamento">Relacionamento</TabsTrigger>
          <TabsTrigger value="responsavel">Responsável</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Produtos mais comprados</CardTitle>
            </CardHeader>
            <CardContent>
              {m.topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem histórico de compras.</p>
              ) : (
                <div className="divide-y">
                  {m.topProducts.map((p) => (
                    <div key={p.name} className="flex items-center justify-between py-2">
                      <span className="text-sm">{p.name}</span>
                      <span className="text-sm font-medium">
                        {p.quantity} un · {formatCurrency(p.total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Última compra</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p>
                Data:{" "}
                {m.lastOrderDate
                  ? new Date(m.lastOrderDate).toLocaleDateString("pt-BR")
                  : "Nenhuma compra registrada"}
              </p>
              <p>Valor: {formatCurrency(m.lastOrderValue)}</p>
              <p>
                Dias sem comprar: {m.daysSinceLast === null ? "—" : m.daysSinceLast}
              </p>
            </CardContent>
          </Card>
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
                ].map(([key, label]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={key}>{label}</Label>
                    <Input
                      id={key}
                      value={form[key as keyof typeof form]}
                      onChange={(e) => setForm({ ...form, [key!]: e.target.value })}
                      required={key === "name"}
                    />
                  </div>
                ))}
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

        <TabsContent value="pedidos" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de pedidos</CardTitle>
            </CardHeader>
            <CardContent>
              {data.orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum pedido registrado.</p>
              ) : (
                <div className="divide-y">
                  {data.orders.map((order) => (
                    <Link
                      key={order.id}
                      to="/pedidos/$id"
                      params={{ id: order.id }}
                      className="flex items-center justify-between py-3 hover:opacity-80"
                    >
                      <div>
                        <p className="font-medium">
                          {new Date(order.created_at).toLocaleDateString("pt-BR")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {ORDER_STATUS_LABELS[order.status] ?? order.status} ·{" "}
                          {order.order_items?.length ?? 0} itens
                        </p>
                      </div>
                      <span className="font-semibold">
                        {formatCurrency(Number(order.total ?? 0))}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="relacionamento" className="space-y-4 pt-4">
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
                    {["nota", "ligacao", "reuniao", "email", "visita"].map((k) => (
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
              <CardTitle>Histórico de relacionamento</CardTitle>
            </CardHeader>
            <CardContent>
              {data.interactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma interação registrada.</p>
              ) : (
                <div className="space-y-3">
                  {data.interactions.map((i) => (
                    <div key={i.id} className="border-l-2 border-primary/40 pl-3">
                      <p className="text-sm font-medium">{i.kind}</p>
                      <p className="text-sm">{i.content}</p>
                      <p className="text-xs text-muted-foreground">
                        {i.user_name} · {new Date(i.created_at).toLocaleString("pt-BR")}
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
