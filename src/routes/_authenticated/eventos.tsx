import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listEvents } from "@/lib/admin.functions";
import {
  NEXUS_EVENT_LABELS,
  automationName,
  automationSource,
  automationStatus,
  automationTarget,
  formatDateTime,
} from "@/lib/commercial-constants";

const automationsQueryOptions = (eventType?: string) =>
  queryOptions({
    queryKey: ["events", eventType ?? "all"],
    queryFn: () => listEvents({ data: { eventType, limit: 100 } }),
  });

export const Route = createFileRoute("/_authenticated/eventos")({
  loader: ({ context }) => context.queryClient.ensureQueryData(automationsQueryOptions()),
  component: AutomationsPage,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive">
      Não foi possível carregar as automações: {(error as Error).message}
    </p>
  ),
  notFoundComponent: () => <p className="text-sm text-muted-foreground">Página não encontrada.</p>,
  head: () => ({
    meta: [
      { title: "Automações - Nexus 360" },
      {
        name: "description",
        content: "Fluxos automatizados entre sistemas, com evento inicial, destino e execuções.",
      },
      { property: "og:title", content: "Automações - Nexus 360" },
      {
        property: "og:description",
        content: "Acompanhe os fluxos de automação do Nexus 360 e suas últimas execuções.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AutomationsPage() {
  const [filter, setFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: events } = useSuspenseQuery(
    automationsQueryOptions(filter === "all" ? undefined : filter),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Automações</h1>
          <p className="text-muted-foreground">
            Fluxos automatizados entre o Nexus 360 e os sistemas conectados.
          </p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os eventos iniciais</SelectItem>
            {Object.entries(NEXUS_EVENT_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Execuções de automações ({events.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {events.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma automação executada ainda.</p>
          )}
          {events.map((e) => {
            const status = automationStatus(e.status);
            return (
              <div key={e.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{automationName(e.event_type, e.entity_type)}</span>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <div className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                  <p>
                    <span className="text-foreground">Evento inicial:</span>{" "}
                    {NEXUS_EVENT_LABELS[e.event_type] ?? e.event_type}
                  </p>
                  <p>
                    <span className="text-foreground">Última execução:</span>{" "}
                    {formatDateTime(e.delivered_at ?? e.created_at)}
                  </p>
                  <p>
                    <span className="text-foreground">Sistema origem:</span>{" "}
                    {automationSource(e.entity_type)}
                  </p>
                  <p>
                    <span className="text-foreground">Sistema destino:</span>{" "}
                    {automationTarget(e.event_type)}
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Registro: {e.entity_id ?? "—"} · Disparado por {e.created_by_name}
                </p>
                {e.last_error && (
                  <p className="mt-1 text-sm text-destructive">
                    Erro na execução: {e.last_error}
                  </p>
                )}
                <button
                  type="button"
                  className="mt-2 text-xs underline text-muted-foreground"
                  onClick={() => setOpenId(openId === e.id ? null : e.id)}
                >
                  {openId === e.id ? "Ocultar dados técnicos" : "Ver dados técnicos"}
                </button>
                {openId === e.id && (
                  <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
                    {JSON.stringify(e.payload, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
