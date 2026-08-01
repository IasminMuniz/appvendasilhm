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
import { NEXUS_EVENT_LABELS } from "@/lib/commercial-constants";

const eventsQueryOptions = (eventType?: string) =>
  queryOptions({
    queryKey: ["events", eventType ?? "all"],
    queryFn: () => listEvents({ data: { eventType, limit: 100 } }),
  });

export const Route = createFileRoute("/_authenticated/eventos")({
  loader: ({ context }) => context.queryClient.ensureQueryData(eventsQueryOptions()),
  component: EventsPage,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive">Não foi possível carregar os eventos: {error.message}</p>
  ),
  notFoundComponent: () => <p className="text-sm text-muted-foreground">Página não encontrada.</p>,
  head: () => ({
    meta: [
      { title: "Eventos internos - Nexus 360" },
      {
        name: "description",
        content: "Histórico de eventos comerciais e status de entrega para automações externas.",
      },
      { property: "og:title", content: "Eventos internos - Nexus 360" },
      {
        property: "og:description",
        content: "Auditoria dos eventos do Nexus 360 enviados para webhooks e automações.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function statusVariant(status: string) {
  if (status === "entregue") return "default" as const;
  if (status === "erro") return "destructive" as const;
  return "secondary" as const;
}

function EventsPage() {
  const [filter, setFilter] = useState<string>("all");
  const { data: events } = useSuspenseQuery(
    eventsQueryOptions(filter === "all" ? undefined : filter),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Eventos internos</h1>
          <p className="text-muted-foreground">
            Histórico dos eventos do Nexus 360 e status do envio para o webhook (n8n).
          </p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os eventos</SelectItem>
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
          <CardTitle>Histórico ({events.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {events.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
          )}
          {events.map((e) => (
            <div key={e.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {NEXUS_EVENT_LABELS[e.event_type] ?? e.event_type}
                </span>
                <Badge variant="outline">{e.event_type}</Badge>
                <Badge variant={statusVariant(e.status ?? "pendente")}>
                  {e.status ?? "pendente"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {new Date(e.created_at).toLocaleString("pt-BR")}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {e.entity_type} · {e.entity_id ?? "—"} · por {e.created_by_name}
              </p>
              {e.last_error && (
                <p className="mt-1 text-sm text-destructive">Erro no envio: {e.last_error}</p>
              )}
              <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
                {JSON.stringify(e.payload, null, 2)}
              </pre>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
