import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/compras")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Compras - Nexus 360" },
      { name: "description", content: "Registre as compras de mercadorias da loja." },
      { property: "og:title", content: "Compras - Nexus 360" },
      { property: "og:description", content: "Registre as compras de mercadorias da loja." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Compras</h1>
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Em breve: Registre as compras de mercadorias da loja.
        </CardContent>
      </Card>
    </div>
  );
}
