import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listQuotes } from "@/lib/quotes.functions";
import { QUOTE_STATUS_LABELS, formatCurrency } from "@/lib/commercial-constants";

const quotesQueryOptions = () =>
  queryOptions({ queryKey: ["quotes"], queryFn: () => listQuotes() });

export const Route = createFileRoute("/_authenticated/orcamentos/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(quotesQueryOptions()),
  component: QuotesPage,
  head: () => ({
    meta: [
      { title: "Orçamentos - Plataforma Comercial" },
      {
        name: "description",
        content: "Crie, aprove e converta orçamentos comerciais em pedidos com PDF e envio por e-mail.",
      },
    ],
  }),
});

const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  rascunho: "outline",
  aguardando_aprovacao: "secondary",
  aprovado: "default",
  reprovado: "destructive",
  convertido: "default",
};

function QuotesPage() {
  const { data: quotes } = useSuspenseQuery(quotesQueryOptions());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orçamentos</h1>
          <p className="text-muted-foreground">Propostas comerciais e aprovações de desconto.</p>
        </div>
        <Button asChild>
          <Link to="/orcamentos/novo">
            <Plus className="mr-2 h-4 w-4" />
            Novo orçamento
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de orçamentos</CardTitle>
        </CardHeader>
        <CardContent>
          {quotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum orçamento criado.</p>
          ) : (
            <div className="divide-y">
              {quotes.map((quote) => (
                <Link
                  key={quote.id}
                  to="/orcamentos/$id"
                  params={{ id: quote.id }}
                  className="flex items-center justify-between py-3 hover:opacity-80"
                >
                  <div>
                    <p className="font-medium">
                      #{quote.number} · {quote.customers?.company_name || quote.customers?.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(quote.created_at).toLocaleDateString("pt-BR")} · Desconto{" "}
                      {Number(quote.discount_percent ?? 0)}%
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">
                      {formatCurrency(Number(quote.total ?? 0))}
                    </span>
                    <Badge variant={variants[quote.status] ?? "outline"}>
                      {QUOTE_STATUS_LABELS[quote.status] ?? quote.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
