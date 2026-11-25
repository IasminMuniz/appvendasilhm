import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CopyPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductForm, emptyProduct, productToFormValues } from "@/components/products/product-form";
import { createProduct, getProduct } from "@/lib/products.functions";

export const Route = createFileRoute("/_authenticated/produtos/novo")({
  // ?copiar=<id> abre o cadastro já preenchido com os dados desse produto (Duplicar).
  validateSearch: z.object({ copiar: z.string().uuid().optional() }),
  component: NewProductPage,
  head: () => ({
    meta: [
      { title: "Novo produto - Nexus 360" },
      {
        name: "description",
        content: "Cadastre uma peça com fornecedor, estilo, cor, tamanho, custo e SKU automático.",
      },
      { property: "og:title", content: "Novo produto - Nexus 360" },
      { property: "og:description", content: "Cadastro de peças da loja com SKU automático." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function NewProductPage() {
  const { copiar } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const source = useQuery({
    queryKey: ["product", copiar],
    queryFn: () => getProduct({ data: { id: copiar! } }),
    enabled: !!copiar,
  });
  const original = source.data?.product;

  const mutation = useMutation({
    mutationFn: createProduct,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      if (copiar)
        toast.success("Produto duplicado com sucesso. Agora adicione as fotos desta peça.");
      // Vai direto para a página do produto, onde ficam as fotos.
      if (created?.id) navigate({ to: "/produtos/$id", params: { id: created.id } });
      else navigate({ to: "/produtos" });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Erro ao criar produto."),
  });

  // Na cópia: mesmos dados, mas o Modelo nº é recalculado para não repetir o SKU.
  const initial = original
    ? { ...productToFormValues(original), model_number: null }
    : emptyProduct;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" asChild>
        <Link
          to={copiar ? "/produtos/$id" : "/produtos"}
          params={copiar ? { id: copiar } : undefined}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>{copiar ? "Duplicar produto" : "Novo produto"}</CardTitle>
          {original && (
            <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm">
              <CopyPlus className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Você está criando uma cópia de <strong>{original.name}</strong>. Altere o que for
                diferente (cor, tamanho, estoque...) e salve. O produto original não muda.
              </p>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {copiar && source.isPending ? (
            <p className="text-sm text-muted-foreground">Carregando dados do produto...</p>
          ) : copiar && source.isError ? (
            <p role="alert" className="text-sm text-destructive">
              Não foi possível carregar o produto para duplicar.
            </p>
          ) : (
            <ProductForm
              key={copiar ?? "novo"}
              initial={initial}
              submitLabel={copiar ? "Salvar cópia e adicionar fotos" : "Salvar e adicionar fotos"}
              pending={mutation.isPending}
              error={error}
              onSubmit={(v) => {
                setError(null);
                mutation.mutate({
                  data: {
                    ...v,
                    // Na cópia, leva também os campos que não aparecem no formulário.
                    category: original?.category ?? "",
                    commercial_description: original?.commercial_description ?? "",
                    technical_description: original?.technical_description ?? "",
                    purpose: original?.purpose ?? "",
                    benefits: original?.benefits ?? "",
                    applications: original?.applications ?? "",
                    dimensions: original?.dimensions ?? "",
                    weight: original?.weight ?? "",
                    specifications:
                      (original?.specifications as { label: string; value: string }[] | null) ?? [],
                  },
                });
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
