import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getDashboard, type DashboardFilters } from "@/lib/dashboard.functions";
import { LEAD_STAGES, formatCurrency, formatDate } from "@/lib/commercial-constants";

const ALL = "__all__";

const dashboardQueryOptions = (filters: DashboardFilters) =>
  queryOptions({
    queryKey: ["dashboard", filters],
    queryFn: () => getDashboard({ data: filters }),
  });

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQueryOptions({})),
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Dashboard Comercial - Plataforma Comercial" },
      {
        name: "description",
        content:
          "Indicadores de vendas, funil, metas e rankings por empresa, equipe, supervisor e vendedor.",
      },
      { property: "og:title", content: "Dashboard Comercial" },
      { property: "og:description", content: "Indicadores de vendas, funil, metas e rankings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const VIEW_LABELS: Record<string, string> = {
  empresa: "Visão Empresa",
  gerente: "Visão Gerência",
  supervisor: "Visão Supervisão",
  vendedor: "Visão Vendedor",
};

const stageLabel = (stage: string) => LEAD_STAGES.find((s) => s.value === stage)?.label ?? stage;

function DashboardPage() {
  const [filters, setFilters] = useState<DashboardFilters>({});
  const { data } = useSuspenseQuery(dashboardQueryOptions(filters));

  const set = (key: keyof DashboardFilters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value === ALL ? "" : value }));

  const showTeams = data.view === "empresa" || data.view === "gerente";
  const showSellers = data.view !== "vendedor";

  const kpis = [
    { label: "Receita no período", value: formatCurrency(data.totals.revenue) },
    { label: "Vendas", value: String(data.totals.orders) },
    { label: "Ticket médio", value: formatCurrency(data.totals.averageTicket) },
    { label: "Previsão ponderada", value: formatCurrency(data.forecast) },
    { label: "Pipeline aberto", value: formatCurrency(data.pipelineValue) },
    { label: "Conversão de leads", value: `${data.totals.conversionRate.toFixed(1)}%` },
    { label: "Orçamentos abertos", value: formatCurrency(data.quoteStats.openValue) },
    { label: "Clientes na base", value: String(data.totals.customers) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Comercial</h1>
          <p className="text-muted-foreground">
            Indicadores conforme seu nível de acesso e filtros aplicados.
          </p>
        </div>
        <Badge variant="secondary">{VIEW_LABELS[data.view]}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-2">
            <Label htmlFor="from">De</Label>
            <Input
              id="from"
              type="date"
              value={filters.from ?? ""}
              onChange={(e) => set("from", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to">Até</Label>
            <Input
              id="to"
              type="date"
              value={filters.to ?? ""}
              onChange={(e) => set("to", e.target.value)}
            />
          </div>
          {showSellers ? (
            <div className="space-y-2">
              <Label>Vendedor</Label>
              <Select value={filters.sellerId || ALL} onValueChange={(v) => set("sellerId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {data.filterOptions.sellers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {showTeams ? (
            <div className="space-y-2">
              <Label>Equipe</Label>
              <Select value={filters.teamId || ALL} onValueChange={(v) => set("teamId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas</SelectItem>
                  {data.filterOptions.teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>Região</Label>
            <Select value={filters.region || ALL} onValueChange={(v) => set("region", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                {data.filterOptions.regions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Produto</Label>
            <Select value={filters.product || ALL} onValueChange={(v) => set("product", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {data.filterOptions.products.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => setFilters({})}>
              Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Evolução mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-48 items-end gap-1">
              {data.monthlySeries.map((m) => {
                const max = Math.max(...data.monthlySeries.map((x) => x.total), 1);
                return (
                  <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-primary"
                      style={{ height: `${(m.total / max) * 100}%`, minHeight: "2px" }}
                      title={formatCurrency(m.total)}
                    />
                    <span className="text-[10px] text-muted-foreground">{m.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Funil de oportunidades</CardTitle>
          </CardHeader>
          <CardContent>
            {data.funnel.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem leads no período.</p>
            ) : (
              <div className="divide-y">
                {data.funnel.map((f) => (
                  <div key={f.stage} className="flex items-center justify-between py-2 text-sm">
                    <span>{stageLabel(f.stage)}</span>
                    <span className="text-muted-foreground">
                      {f.count} · {formatCurrency(f.value)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {showSellers ? (
          <Card>
            <CardHeader>
              <CardTitle>Ranking de vendedores</CardTitle>
            </CardHeader>
            <CardContent>
              {data.sellerRanking.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem vendas no período.</p>
              ) : (
                <div className="divide-y">
                  {data.sellerRanking.slice(0, 10).map((s, index) => (
                    <div key={s.sellerId} className="flex items-center justify-between py-2 text-sm">
                      <span>
                        {index + 1}. {s.name}
                      </span>
                      <span className="font-medium">{formatCurrency(s.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {showTeams ? (
          <Card>
            <CardHeader>
              <CardTitle>Ranking de equipes</CardTitle>
            </CardHeader>
            <CardContent>
              {data.teamRanking.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem vendas por equipe no período.</p>
              ) : (
                <div className="divide-y">
                  {data.teamRanking.map((t) => (
                    <div key={t.teamId} className="flex items-center justify-between py-2 text-sm">
                      <span>{t.name}</span>
                      <span className="font-medium">{formatCurrency(t.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Top produtos</CardTitle>
          </CardHeader>
          <CardContent>
            {data.productRanking.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem vendas no período.</p>
            ) : (
              <div className="divide-y">
                {data.productRanking.map((p) => (
                  <div key={p.name} className="flex items-center justify-between py-2 text-sm">
                    <span>{p.name}</span>
                    <span className="font-medium">
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
            <CardTitle>Top clientes</CardTitle>
          </CardHeader>
          <CardContent>
            {data.customerRanking.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem vendas no período.</p>
            ) : (
              <div className="divide-y">
                {data.customerRanking.map((c) => (
                  <Link
                    key={c.customerId}
                    to="/clientes/$id"
                    params={{ id: c.customerId }}
                    className="flex items-center justify-between py-2 text-sm hover:opacity-80"
                  >
                    <span>{c.name}</span>
                    <span className="font-medium">{formatCurrency(c.total)}</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {showTeams ? (
          <Card>
            <CardHeader>
              <CardTitle>Desempenho por região</CardTitle>
            </CardHeader>
            <CardContent>
              {data.regionRanking.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados de região.</p>
              ) : (
                <div className="divide-y">
                  {data.regionRanking.map((r) => (
                    <div key={r.region} className="flex items-center justify-between py-2 text-sm">
                      <span>{r.region}</span>
                      <span className="font-medium">{formatCurrency(r.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Motivos de perda</CardTitle>
          </CardHeader>
          <CardContent>
            {data.lossReasons.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma perda registrada.</p>
            ) : (
              <div className="divide-y">
                {data.lossReasons.map((l) => (
                  <div key={l.reason} className="flex items-center justify-between py-2 text-sm">
                    <span>{l.reason}</span>
                    <span className="font-medium">{l.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Metas do período</CardTitle>
          </CardHeader>
          <CardContent>
            {data.goalProgress.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma meta ativa.</p>
            ) : (
              <div className="space-y-3">
                {data.goalProgress.map((g) => (
                  <div key={g.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{g.owner}</span>
                      <span className="text-muted-foreground">
                        {formatCurrency(g.achieved)} / {formatCurrency(g.target)}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded bg-muted">
                      <div
                        className="h-2 rounded bg-primary"
                        style={{ width: `${Math.min(100, g.percent)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clientes sem compra recente</CardTitle>
          </CardHeader>
          <CardContent>
            {data.inactiveCustomers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum cliente inativo.</p>
            ) : (
              <div className="divide-y">
                {data.inactiveCustomers.map((c) => (
                  <Link
                    key={c.id}
                    to="/clientes/$id"
                    params={{ id: c.id }}
                    className="flex items-center justify-between py-2 text-sm hover:opacity-80"
                  >
                    <span>{c.name}</span>
                    <span className="text-muted-foreground">
                      {c.days} dias · {formatDate(c.lastOrder)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
