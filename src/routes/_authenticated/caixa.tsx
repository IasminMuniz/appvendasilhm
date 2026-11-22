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
import { getCashFlow } from "@/lib/finance.functions";
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
    reservePct: String(data.plan.reservePct),
    growthPct: String(data.plan.growthPct),
  });
  useEffect(() => {
    setPlan({
      initialCapital: String(data.plan.initialCapital),
      otherPurposesPct: String(data.plan.otherPurposesPct),
      reservePct: String(data.plan.reservePct),
      growthPct: String(data.plan.growthPct),
    });
  }, [data.plan]);
  const save = useMutation({
    mutationFn: saveCashPlan,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash-flow"] });
      toast.success("Plano do caixa salvo.");
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
      label: `Outros fins (${p.otherPurposesPct}% da venda)`,
      value: s.otherPurposes,
      hint: "Separado para o que você definir. Não é lucro.",
    },
    {
      label: `Reserva de caixa (${p.reservePct}% do lucro)`,
      value: s.reserve,
      hint: "Para emergências, meses fracos e contas fixas (DAS, apps).",
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          title="Saldo em caixa agora"
          value={data.balance}
          hint="Aporte + o que entrou das vendas − compras, despesas pagas e custos. Deve bater com o dinheiro da loja na conta."
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
            {data.upcoming.length > 0 && (
              <div>
                <p className="font-medium">Contas dos próximos 30 dias:</p>
                <ul className="mt-1 space-y-1">
                  {data.upcoming.map((u) => (
                    <li
                      key={u.description + u.date}
                      className={u.overdue ? "text-destructive" : ""}
                    >
                      {formatDate(u.date)} · {u.description} · {formatCurrency(u.amount)}
                      {u.overdue ? " (vencida)" : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plano do caixa</CardTitle>
          <p className="text-sm text-muted-foreground">
            Defina quanto você colocou para começar e quanto de cada venda vai para cada pote.
          </p>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate({
                data: {
                  initialCapital: Number(plan.initialCapital || 0),
                  otherPurposesPct: Number(plan.otherPurposesPct || 0),
                  reservePct: Number(plan.reservePct || 0),
                  growthPct: Number(plan.growthPct || 0),
                },
              });
            }}
          >
            {(
              [
                [
                  "initialCapital",
                  "Aporte inicial (R$)",
                  "Dinheiro seu que entrou na loja para começar.",
                ],
                [
                  "otherPurposesPct",
                  "Outros fins (% da venda)",
                  "Ex.: 10% de cada venda para outros objetivos.",
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
                  step={key === "initialCapital" ? "0.01" : "1"}
                  value={plan[key]}
                  onChange={(e) => setPlan({ ...plan, [key]: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">{hint}</p>
              </div>
            ))}
            <div className="sm:col-span-2 lg:col-span-4">
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
