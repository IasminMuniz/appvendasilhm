import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Vendas Comercial" },
      { name: "description", content: "App de vendas comercial para gestão de clientes, produtos e pedidos." },
      { property: "og:title", content: "Vendas Comercial" },
      { property: "og:description", content: "App de vendas comercial para gestão de clientes, produtos e pedidos." },
    ],
  }),
});

function Index() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-3xl font-bold text-primary-foreground">
            V
          </div>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          App de Vendas Comercial
        </h1>
        <p className="mt-6 text-lg text-muted-foreground">
          Gerencie clientes, produtos e pedidos em um só lugar. Uma base completa para sua equipe comercial.
        </p>
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
