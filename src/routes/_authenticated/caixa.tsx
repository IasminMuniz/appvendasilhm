import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { deleteContribution, getCashFlow, saveContribution } from "@/lib/finance.functions";
import { saveCashPlan } from "@/lib/store.functions";
import { formatCurrency, formatDate } from "@/lib/commercial-constants";

const thisMonth = () => new Date().toISOString().slice(0, 7);
const cashQuery = (month: string) =>
  queryOptions({ queryKey: ["cash-flow", month], queryFn: () => getCashFlow({ data: { month } }) });

export const Route = createFileRoute("/_authenticated/caixa")({
  loader: ({ context }) => context.queryClient.ensureQueryData(cashQuery(thisMonth())),
  component: CashPage,
  head: () => ({
    meta: [
      { title: "Caixa - Nexus 360" },
      {
        name: "description",
        content: "Saldo, entradas e saídas e a divisão do dinheiro de cada venda.",
      },
      { property: "og:title", content: "Caixa - Nexus 360" },
      { property: "og:description", content: "Fluxo de caixa da loja." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function lastMonths(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const ym = d.toISOString().slice(0, 7);
    const name = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
    return { value: ym, label: name.charAt(0).toUpperCase() + name.slice(1) };
  });
}

function Stat({
  title,
  value,
  hint,
  tone,
}: {
  title: string;
  value: number;
  hint: string;
  tone?: "bad";
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={`text-2xl font-bold ${tone === "bad" || value < 0 ? "text-destructive" : ""}`}
        >
          {formatCurrency(value)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function CashPage() {
  const [month, setMonth] = useState(thisMonth());
  const { data } = useSuspenseQuery(cashQuery(month));
  const qc = useQueryClient();
  const [plan, setPlan] = useState({
    initialCapital: String(data.plan.initialCapital),
    otherPurposesPct: String(data.plan.otherPurposesPct),
    taxPerSale: String(data.plan.taxPerSale),
    reservePct: String(data.plan.reservePct),
    growthPct: String(data.plan.growthPct),
  });
  useEffect(() => {
    setPlan({
      initialCapital: String(data.plan.initialCapital),
      otherPurposesPct: String(data.plan.otherPurposesPct),
      taxPerSale: String(data.plan.taxPerSale),
      reservePct: String(data.plan.reservePct),
      growthPct: String(data.plan.growthPct),
    });
  }, [data.plan]);
  const save = useMutation({
    mutationFn: saveCashPlan,
    onSuccess: () => {
      for (const k of ["cash-flow", "cash-plan", "orders", "order", "dashboard"])
        qc.invalidateQueries({ queryKey: [k] });
      toast.success("Plano do caixa salvo.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [aporte, setAporte] = useState({
    contribution_date: new Date().toISOString().slice(0, 10),
    amount: "",
    description: "",
  });
  const refreshCash = () => {
    for (const k of ["cash-flow", "dashboard"]) qc.invalidateQueries({ queryKey: [k] });
  };
  const addAporte = useMutation({
    mutationFn: saveContribution,
    onSuccess: () => {
      refreshCash();
      setAporte({ ...aporte, amount: "", description: "" });
      toast.success("Aporte registrado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeAporte = useMutation({
    mutationFn: deleteContribution,
    onSuccess: () => {
      refreshCash();
      toast.success("Aporte excluído.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const s = data.split;
  const p = data.plan;
  const pots: { label: string; value: number; hint: string }[] = [
    {
      label: "Taxas e custos da venda",
      value: s.fees,
      hint: "Comissão da Shopee, anúncios e frete lançados na venda. Já saiu.",
    },
    {
      label: "Repor as peças vendidas",
      value: s.restock,
      hint: "Exatamente o que as peças vendidas custaram. Use só para comprar mercadoria.",
    },
    {
      label: "Repor embalagens",
      value: s.packaging,
      hint: "Envelope, sacola, tag e afins de cada peça vendida.",
    },
    {
      label: "Reserva para o DAS",
      value: s.tax,
      hint: `${p.taxPerSale.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} de cada venda, para pagar o DAS do MEI (vence dia 20).`,
    },
    {
      label: `Outros fins (${p.otherPurposesPct}% da venda)`,
      value: s.otherPurposes,
      hint: "Separado para o que você definir. Não é lucro.",
    },
    {
      label: `Reserva de caixa (${p.reservePct}% do lucro)`,
      value: s.reserve,
      hint: "Para emergências, meses fracos e contas fixas (apps, assinaturas).",
    },
    {
      label: `Crescimento (${p.growthPct}% do lucro)`,
      value: s.growth,
      hint: "Para comprar mais peças do que vendeu e aumentar o estoque.",
    },
    { label: "Seu lucro livre", value: s.ownerProfit, hint: "O que sobra para você retirar." },
  ];
  const max = Math.max(1, s.revenue);
  const periodLabel = month === "all" ? "desde o início" : "no mês";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Caixa</h1>
          <p className="text-muted-foreground">
            Quanto dinheiro a loja tem e para onde vai o dinheiro de cada venda.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <a href="#aportes">
              <Plus className="mr-2 h-4 w-4" />
              Registrar aporte
            </a>
          </Button>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-56" aria-label="Período">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {lastMonths(12).map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
              <SelectItem value="all">Desde o início</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card id="aportes" className="scroll-mt-4">
        <CardHeader>
          <CardTitle>Aportes</CardTitle>
          <p className="text-sm text-muted-foreground">
            Dinheiro seu colocado na loja: o investimento inicial (ex.: R$ 1.000 para as primeiras
            compras) e cada valor extra que você colocar depois. Inclua também a fatura do cartão
            pessoal quando pagar despesas da loja com o seu dinheiro. Total:{" "}
            {formatCurrency(data.contributed)}
          </p>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <form
            className="grid gap-3 sm:grid-cols-[auto_auto_1fr_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              addAporte.mutate({
                data: { ...aporte, amount: Number(aporte.amount || 0) },
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="ap-date">Data</Label>
              <Input
                id="ap-date"
                type="date"
                required
                value={aporte.contribution_date}
                onChange={(e) => setAporte({ ...aporte, contribution_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ap-amount">Valor (R$)</Label>
              <Input
                id="ap-amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={aporte.amount}
                onChange={(e) => setAporte({ ...aporte, amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ap-desc">Descrição</Label>
              <Input
                id="ap-desc"
                placeholder="Ex.: Aporte inicial"
                value={aporte.description}
                onChange={(e) => setAporte({ ...aporte, description: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={addAporte.isPending}>
              {addAporte.isPending ? "Salvando..." : "Adicionar aporte"}
            </Button>
          </form>
          {data.contributions.length === 0 ? (
            <p className="text-muted-foreground">Nenhum aporte registrado.</p>
          ) : (
            <ul className="divide-y">
              {data.contributions.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    {formatDate(c.date)}
                    {c.description ? ` · ${c.description}` : ""}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">{formatCurrency(c.amount)}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Excluir aporte"
                      title="Excluir aporte"
                      disabled={removeAporte.isPending}
                      onClick={() => {
                        if (window.confirm("Excluir este aporte?"))
                          removeAporte.mutate({ data: { id: c.id } });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          title="Você aportou"
          value={data.contributed}
          hint="Dinheiro seu colocado na loja: o aporte inicial e os seguintes."
        />
        <Stat
          title="Dinheiro da loja agora"
          value={data.cashOnHand}
          hint="Aportes + o que entrou das vendas − tudo que já saiu. Se ficar negativo, falta aportar."
        />
        <Stat
          title="Já saiu da loja"
          value={data.totalOut}
          hint="Tudo que a loja já gastou: compras de mercadoria, despesas pagas e custos das vendas."
        />
        <Stat
          title="Já entrou das vendas"
          value={data.totalIn}
          hint="Dinheiro que as clientes já pagaram (descontadas as taxas)."
        />
        <Stat
          title={data.balance < 0 ? "Falta recuperar" : "Resultado até agora"}
          value={data.balance < 0 ? -data.balance : data.balance}
          tone={data.balance < 0 ? "bad" : undefined}
          hint={
            data.balance < 0
              ? "Quanto ainda falta entrar de vendas para cobrir tudo que já saiu da loja."
              : "As vendas já cobriram tudo que saiu da loja. Este é o que sobrou."
          }
        />
        <Stat
          title="Disponível para nova compra"
          value={data.availableToBuy}
          hint="Reposição + crescimento separados das vendas, menos as compras feitas depois da 1ª venda."
        />
        <Stat
          title="Contas a pagar (30 dias)"
          value={data.upcomingTotal}
          hint="Despesas pendentes que vencem até o próximo mês. Deixe esse valor reservado."
          tone={data.upcoming.some((u) => u.overdue) ? "bad" : undefined}
        />
        <Stat
          title={`Seu lucro livre ${periodLabel}`}
          value={s.ownerProfit}
          hint="Depois de repor, reservar e separar os outros fins."
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle>Contas a pagar (próximos 30 dias)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Despesas lançadas como Pendente. Total: {formatCurrency(data.upcomingTotal)}
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/despesas">Ver em Despesas</Link>
          </Button>
        </CardHeader>
        <CardContent className="text-sm">
          {data.upcoming.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma conta pendente nos próximos 30 dias.</p>
          ) : (
            <table className="w-full">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 text-left font-medium">Vencimento</th>
                  <th className="py-1 text-left font-medium">Conta</th>
                  <th className="py-1 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.upcoming.map((u) => (
                  <tr key={u.description + u.date} className={u.overdue ? "text-destructive" : ""}>
                    <td className="py-1.5">
                      {formatDate(u.date)}
                      {u.overdue ? " (vencida)" : ""}
                    </td>
                    <td className="py-1.5">{u.description}</td>
                    <td className="py-1.5 text-right">{formatCurrency(u.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Para onde vai o dinheiro das vendas ({periodLabel})</CardTitle>
          <p className="text-sm text-muted-foreground">
            {data.period.salesCount} venda(s) paga(s) · {formatCurrency(s.revenue)} vendidos
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {s.revenue === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma venda paga neste período ainda.</p>
          ) : (
            pots.map((pot) => (
              <div key={pot.label} className="space-y-1">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="font-medium">{pot.label}</span>
                  <span className={`font-semibold ${pot.value < 0 ? "text-destructive" : ""}`}>
                    {formatCurrency(pot.value)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full rounded bg-primary"
                    style={{ width: `${Math.max(0, Math.min(100, (pot.value / max) * 100))}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{pot.hint}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Entradas e saídas ({periodLabel})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              ["Recebido das vendas (já sem a taxa do canal)", data.period.received],
              ["Compras (mercadoria e embalagens)", -data.period.purchases],
              ["Despesas pagas", -data.period.expenses],
              ["Outros custos lançados nas vendas", -data.period.saleCosts],
            ].map(([l, v]) => (
              <div key={l as string} className="flex justify-between gap-3">
                <span className="text-muted-foreground">{l}</span>
                <span>{formatCurrency(v as number)}</span>
              </div>
            ))}
            <div className="flex justify-between gap-3 border-t pt-2 text-base font-semibold">
              <span>Resultado</span>
              <span className={data.periodResult < 0 ? "text-destructive" : ""}>
                {formatCurrency(data.periodResult)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              No começo o resultado fica negativo por causa da compra do primeiro lote. Isso é
              normal: ele melhora conforme as peças são vendidas.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quando comprar de novo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Compre de novo quando <strong>a maior parte do lote tiver saído</strong> (uns 70%) ou
              quando um modelo que vende bem estiver acabando, usando o dinheiro de{" "}
              <strong>Disponível para nova compra</strong>, e não a reserva.
            </p>
            <p className="text-muted-foreground">Peças em estoque: {data.piecesInStock}</p>
            {data.lowStock.length > 0 ? (
              <div>
                <p className="font-medium">Acabando (1 ou nenhuma peça):</p>
                <ul className="mt-1 space-y-1">
                  {data.lowStock.map((x) => (
                    <li key={x.id}>
                      <Link to="/produtos/$id" params={{ id: x.id }} className="hover:underline">
                        {x.name}
                      </Link>{" "}
                      <span className="text-muted-foreground">
                        · {x.stock} em estoque{x.sku ? ` · ${x.sku}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-muted-foreground">Nenhum produto acabando.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>A receber das clientes</CardTitle>
          <p className="text-sm text-muted-foreground">
            Parcelas ainda não pagas. Total: {formatCurrency(data.toReceiveTotal)}
          </p>
        </CardHeader>
        <CardContent className="text-sm">
          {data.toReceive.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma parcela em aberto.</p>
          ) : (
            <ul className="space-y-1">
              {data.toReceive.map((r) => (
                <li key={r.orderId + r.number} className={r.overdue ? "text-destructive" : ""}>
                  <Link to="/pedidos/$id" params={{ id: r.orderId }} className="hover:underline">
                    {formatDate(r.date)} · {r.customer}
                    {r.count > 1 ? ` · ${r.number}/${r.count}` : ""} · {formatCurrency(r.amount)}
                    {r.overdue ? " (atrasada)" : ""}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plano do caixa</CardTitle>
          <p className="text-sm text-muted-foreground">Quanto de cada venda vai para cada pote.</p>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate({
                data: {
                  initialCapital: Number(plan.initialCapital || 0),
                  otherPurposesPct: Number(plan.otherPurposesPct || 0),
                  taxPerSale: Number(plan.taxPerSale || 0),
                  reservePct: Number(plan.reservePct || 0),
                  growthPct: Number(plan.growthPct || 0),
                },
              });
            }}
          >
            {(
              [
                [
                  "otherPurposesPct",
                  "Outros fins (% da venda)",
                  "Ex.: 10% de cada venda para outros objetivos.",
                ],
                [
                  "taxPerSale",
                  "Reserva para o DAS (R$ por venda)",
                  "Ex.: R$ 8. Use 0 se lançar o DAS em Despesas.",
                ],
                [
                  "reservePct",
                  "Reserva de caixa (% do lucro)",
                  "Sugestão: 20% até juntar 3 meses de contas fixas.",
                ],
                [
                  "growthPct",
                  "Crescimento (% do lucro)",
                  "Para aumentar o estoque além da reposição.",
                ],
              ] as const
            ).map(([key, label, hint]) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  type="number"
                  min="0"
                  step={key === "taxPerSale" ? "0.01" : "1"}
                  value={plan[key]}
                  onChange={(e) => setPlan({ ...plan, [key]: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">{hint}</p>
              </div>
            ))}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Salvando..." : "Salvar plano"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
