import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Copy, CopyPlus, Megaphone, Trash2 } from "lucide-react";
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
import { ProductForm, productToFormValues } from "@/components/products/product-form";
import { ProductImages } from "@/components/products/product-images";
import { buildAdText } from "@/lib/ad-text";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
  const [ad, setAd] = useState("");

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
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao excluir produto."),
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

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" asChild>
            <Link to="/produtos/novo" search={{ copiar: id }}>
              <CopyPlus className="mr-2 h-4 w-4" />
              Duplicar
            </Link>
          </Button>

          <Dialog onOpenChange={(o) => o && setAd(buildAdText(integration))}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Megaphone className="mr-2 h-4 w-4" />
                Gerar anúncio
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Anúncio</DialogTitle>
                <DialogDescription>
                  Texto no modelo da loja. Ajuste a frase de abertura e as características se
                  quiser, e copie.
                </DialogDescription>
              </DialogHeader>
              <Textarea rows={16} value={ad} onChange={(e) => setAd(e.target.value)} />
              <DialogFooter>
                <Button
                  onClick={async () => {
                    await navigator.clipboard.writeText(ad);
                    toast.success("Anúncio copiado!");
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar anúncio
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estoque: entradas e saídas</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {data.movement && data.movement.entradas > 0 ? (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground">Entradas (compras recebidas)</p>
                <p className="text-2xl font-semibold">{data.movement.entradas}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground">Saídas (vendas)</p>
                <p className="text-2xl font-semibold">{data.movement.saidas}</p>
              </div>
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-muted-foreground">Em estoque</p>
                <p className="text-2xl font-bold">{data.movement.estoque}</p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Nenhuma compra recebida lançada para este produto. O estoque é o número digitado no
              cadastro
              {data.movement?.saidas
                ? `, já descontadas ${data.movement.saidas} peça(s) vendida(s)`
                : ""}
              . Lance a compra em Compras (status Recebido) para o estoque ser calculado sozinho.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Editar produto</CardTitle>
          <p className="text-sm text-muted-foreground">
            Atualizado em: {formatDateTime(integration.updated_at)}
          </p>
        </CardHeader>
        <CardContent>
          <ProductForm
            initial={productToFormValues(integration)}
            productId={id}
            stockLocked={!!data.movement && data.movement.entradas > 0}
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
                  specifications:
                    (integration.specifications as { label: string; value: string }[]) ?? [],
                },
              });
            }}
          />
        </CardContent>
      </Card>

      <ProductImages productId={id} images={data.images} />
    </div>
  );
}
