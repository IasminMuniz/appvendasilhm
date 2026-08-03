import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const NEXUS_DESCRIPTION =
  "Nexus 360 é uma plataforma de integração, gestão comercial e inteligência de dados que centraliza informações de diferentes sistemas corporativos, permitindo automações, acompanhamento de processos e análise de indicadores.";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Nexus 360 - Integração e inteligência comercial" },
      { name: "description", content: NEXUS_DESCRIPTION.slice(0, 155) },
      { property: "og:title", content: "Nexus 360 - Integração e inteligência comercial" },
      { property: "og:description", content: NEXUS_DESCRIPTION.slice(0, 155) },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Index() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-3xl font-bold text-primary-foreground">
            N
          </div>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Nexus 360
        </h1>
        <p className="mt-6 text-lg text-muted-foreground">{NEXUS_DESCRIPTION}</p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button asChild size="lg">
            <Link to="/auth">Começar agora</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/auth">Fazer login</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
