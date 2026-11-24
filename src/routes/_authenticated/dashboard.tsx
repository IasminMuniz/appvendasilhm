import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { getStoreDashboard } from "@/lib/finance.functions";
import { breakEven } from "@/lib/store-metrics";
import { formatCurrency } from "@/lib/commercial-constants";

const dashQuery = (month: string) =>
  queryOptions({ queryKey: ["store-dashboard", month], queryFn: () => getStoreDashboard({ data: { month } }) });

const currentMonth = () => new Date().toISOString().slice(0, 7);

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashQuery(currentMonth())),
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Dashboard da loja - Nexus 360" },
      { name: "description", content: "Faturamento, lucro, peças vendidas, canais, estoque, compras e despesas do mês." },
      { property: "og:title", content: "Dashboard da loja - Nexus 360" },
      { property: "og:description", content: "Os números do mês da loja em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function ChannelChart({ title, data, dataKey }: { title: string; data: { channel: string }[]; dataKey: string }) {
  return (
    <Card className="min-w-0">
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="h-64">
        {data.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma venda paga neste mês.</p> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="channel" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey={dataKey} fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardPage() {
  const [month, setMonth] = useState(currentMonth());
  const { data } = useSuspenseQuery(dashQuery(month));
  const be = breakEven({ fixedExpenses: data.fixedExpenses, profit: data.profit, revenue: data.revenue });
  const margin = data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard da loja</h1>
          <p className="text-muted-foreground">Vendas pagas e entregues no mês escolhido.</p>
        </div>
        <Input type="month" className="w-44" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="Mês" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Faturamento do mês" value={formatCurrency(data.revenue)} hint={`${data.salesCount} vendas`} />
        <Kpi label="Lucro do mês" value={formatCurrency(data.profit)} hint={`Margem média ${margin.toFixed(1)}%`} />
        <Kpi label="Peças vendidas" value={String(data.pieces)} />
        <Kpi label="Peças em estoque" value={String(data.stock)} hint={`Valor em estoque (custo) ${formatCurrency(data.stockValue)}`} />
        <Kpi label="Investido em compras (mês)" value={formatCurrency(data.purchasesMonth)} hint={`Total geral ${formatCurrency(data.purchasesTotal)}`} />
        <Kpi label="Despesas do mês" value={formatCurrency(data.expensesMonth)} hint={`Fixas ${formatCurrency(data.fixedExpenses)}`} />
      </div>

      <Card>
        <CardHeader><CardTitle>Falta vender para cobrir as despesas fixas</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {data.fixedExpenses === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma despesa fixa cadastrada neste mês.</p>
          ) : be.covered ? (
            <p className="text-lg font-semibold">Despesas fixas cobertas</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Lucro que ainda falta</p>
                <p className="text-2xl font-bold">{formatCurrency(be.missingProfit)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Em vendas (margem média {be.avgMarginPercent}%)</p>
                <p className="text-2xl font-bold">{be.missingRevenue != null ? formatCurrency(be.missingRevenue) : "Sem vendas com lucro ainda"}</p>
              </div>
            </div>
          )}
          <Progress value={be.coveredPercent} />
          <p className="text-xs text-muted-foreground">{be.coveredPercent.toFixed(0)}% das despesas fixas cobertas pelo lucro do mês</p>
        </CardContent>
      </Card>

      {(data.seminovoProducts > 0 || data.conditions[1]!.pieces > 0) && (
        <Card>
          <CardHeader><CardTitle>Novos x Seminovos</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {data.conditions.map((c) => (
              <div key={c.condition} className="space-y-1 rounded-md border p-3">
                <p className="font-medium">{c.condition === "novo" ? "Novos (revenda)" : "Seminovos (peças próprias)"}</p>
                <p className="text-sm text-muted-foreground">Faturamento <span className="font-semibold text-foreground">{formatCurrency(c.revenue)}</span></p>
                <p className="text-sm text-muted-foreground">Lucro <span className="font-semibold text-foreground">{formatCurrency(c.profit)}</span>{c.revenue > 0 && ` · margem ${((c.profit / c.revenue) * 100).toFixed(1)}%`}</p>
                <p className="text-sm text-muted-foreground">{c.pieces} peça(s) vendida(s)</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {data.returns.trocas + data.returns.devolucoes > 0 && (
        <Card>
          <CardHeader><CardTitle>Trocas e devoluções do mês</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-2xl font-bold">{data.returns.trocas + data.returns.devolucoes}</p>
              <p className="text-xs text-muted-foreground">{data.returns.trocas} troca(s) · {data.returns.devolucoes} devolução(ões)</p>
            </div>
            <div>
              <p className="text-sm font-medium">Motivos</p>
              {data.returns.reasons.map((r) => (
                <p key={r.label} className="text-sm text-muted-foreground">{r.label}: {r.count}</p>
              ))}
            </div>
            <div>
              <p className="text-sm font-medium">Peças que mais voltaram</p>
              {data.returns.pieces.map((r) => (
                <p key={r.label} className="text-sm text-muted-foreground">{r.label}: {r.count}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChannelChart title="Vendas por canal" data={data.channels} dataKey="revenue" />
        <ChannelChart title="Lucro por canal" data={data.channels} dataKey="profit" />
      </div>
    </div>
  );
}
