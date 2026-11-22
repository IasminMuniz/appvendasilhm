import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteProduct, getProduct, updateProduct } from "@/lib/products.functions";
import { formatDateTime } from "@/lib/commercial-constants";
import { ProductForm } from "@/components/products/product-form";

const integrationQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["product", id],
    queryFn: () => getProduct({ data: { id } }),
  });

export const Route = createFileRoute("/_authenticated/produtos/$id")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(integrationQueryOptions(params.id)),
  component: EditIntegrationPage,
  errorComponent: ({ error }) => (
    <p role="alert" className="text-sm text-destructive">
      {(error as Error).message}
    </p>
  ),
  notFoundComponent: () => <p>Produto não encontrado.</p>,
  head: () => ({
    meta: [
      { title: "Editar produto - Nexus 360" },
      {
        name: "description",
        content: "Atualize os dados, custo, preço e SKU da peça.",
      },
      { property: "og:title", content: "Editar produto - Nexus 360" },
      {
        property: "og:description",
        content: "Edição de peças da loja.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function EditIntegrationPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(integrationQueryOptions(id));
  const integration = data.product;

  const [error, setError] = useState<string | null>(null);

  const update = useMutation({
    mutationFn: updateProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      toast.success("Produto atualizado.");
      navigate({ to: "/produtos" });
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Erro ao atualizar produto.";
      setError(message);
      toast.error(message);
    },
  });

  const remove = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto excluído.");
      navigate({ to: "/produtos" });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Erro ao excluir produto."),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link to="/produtos">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={remove.isPending}>
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação remove o produto permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => remove.mutate({ data: { id } })}>
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Editar produto</CardTitle>
          <p className="text-sm text-muted-foreground">
            Atualizado em: {formatDateTime(integration.updated_at)}
          </p>
        </CardHeader>
        <CardContent>
          <ProductForm
            initial={{
              name: integration.name ?? "",
              description: integration.description ?? "",
              price: Number(integration.price ?? 0),
              cost: Number(integration.cost ?? 0),
              stock: Number(integration.stock ?? 0),
              active: integration.active ?? true,
              supplier: integration.supplier ?? "",
              style: integration.style ?? "",
              color: integration.color ?? "",
              pattern: integration.pattern ?? "",
              size: integration.size ?? "",
              model_number: integration.model_number ?? null,
            }}
            submitLabel="Salvar alterações"
            pending={update.isPending}
            error={error}
            onSubmit={(v) => {
              setError(null);
              update.mutate({
                data: {
                  ...v,
                  id,
                  category: integration.category ?? "",
                  code: integration.code ?? "",
                  specifications: (integration.specifications as { label: string; value: string }[]) ?? [],
                },
              });
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
