import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductForm, emptyProduct } from "@/components/products/product-form";
import { createProduct } from "@/lib/products.functions";

export const Route = createFileRoute("/_authenticated/produtos/novo")({
  component: NewProductPage,
  head: () => ({
    meta: [
      { title: "Novo produto - Nexus 360" },
      { name: "description", content: "Cadastre uma peça com fornecedor, estilo, cor, tamanho, custo e SKU automático." },
      { property: "og:title", content: "Novo produto - Nexus 360" },
      { property: "og:description", content: "Cadastro de peças da loja com SKU automático." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function NewProductPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: createProduct,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      // Vai direto para a página do produto, onde ficam as fotos.
      if (created?.id) navigate({ to: "/produtos/$id", params: { id: created.id } });
      else navigate({ to: "/produtos" });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Erro ao criar produto."),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" asChild>
        <Link to="/produtos"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link>
      </Button>
      <Card>
        <CardHeader><CardTitle>Novo produto</CardTitle></CardHeader>
        <CardContent>
          <ProductForm
            initial={emptyProduct}
            submitLabel="Salvar e adicionar fotos"
            pending={mutation.isPending}
            error={error}
            onSubmit={(v) => {
              setError(null);
              mutation.mutate({ data: { ...v, specifications: [] } });
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
