import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getLocationAnalytics } from "@/lib/leads.functions";
import { formatCurrency } from "@/lib/commercial-constants";

type Props = {
  /** Blocos exibidos (padrão: todos). */
  show?: Array<"leadsByState" | "customersByCity" | "conversionByRegion">;
};

/** Painel de BI comercial por localização (estado, cidade e conversão por região). */
export function LocationAnalytics({
  show = ["leadsByState", "customersByCity", "conversionByRegion"],
}: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "location"],
    queryFn: () => getLocationAnalytics(),
  });

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Análise por localização</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Carregando indicadores...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {show.includes("leadsByState") && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Leads por estado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.leadsByState.length === 0 && (
              <p className="text-xs text-muted-foreground">Sem dados.</p>
            )}
            {data.leadsByState.slice(0, 8).map((row) => (
              <div key={row.label} className="flex items-center justify-between text-sm">
                <span>{row.label}</span>
                <Badge variant="secondary">{row.count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {show.includes("customersByCity") && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Clientes por cidade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.customersByCity.length === 0 && (
              <p className="text-xs text-muted-foreground">Sem dados.</p>
            )}
            {data.customersByCity.slice(0, 8).map((row) => (
              <div key={row.label} className="flex items-center justify-between text-sm">
                <span>{row.label}</span>
                <Badge variant="secondary">{row.count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {show.includes("conversionByRegion") && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Conversão por região</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.conversionByRegion.length === 0 && (
              <p className="text-xs text-muted-foreground">Sem dados.</p>
            )}
            {data.conversionByRegion.slice(0, 8).map((row) => (
              <div key={row.state} className="flex items-center justify-between gap-2 text-sm">
                <span>{row.state}</span>
                <span className="text-xs text-muted-foreground">
                  {row.converted}/{row.leads} · {row.rate.toFixed(0)}% ·{" "}
                  {formatCurrency(row.value)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
