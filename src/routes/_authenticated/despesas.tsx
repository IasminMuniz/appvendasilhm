import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/despesas")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Despesas - Nexus 360" },
      { name: "description", content: "Controle as despesas da loja." },
      { property: "og:title", content: "Despesas - Nexus 360" },
      { property: "og:description", content: "Controle as despesas da loja." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Despesas</h1>
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Em breve: Controle as despesas da loja.
        </CardContent>
      </Card>
    </div>
  );
}
