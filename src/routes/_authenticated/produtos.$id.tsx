import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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

const productQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["product", id],
    queryFn: () => getProduct({ data: { id } }),
  });

export const Route = createFileRoute("/_authenticated/produtos/$id")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(productQueryOptions(params.id)),
  component: EditProductPage,
  errorComponent: ({ error }) => (
    <p role="alert" className="text-sm text-destructive">
      {error.message}
    </p>
  ),
  notFoundComponent: () => <p>Produto não encontrado.</p>,
  head: () => ({
    meta: [
      { title: "Editar Produto - Vendas Comercial" },
      { name: "description", content: "Atualize preço, descrição e status do produto." },
      { property: "og:title", content: "Editar Produto - Vendas Comercial" },
      { property: "og:description", content: "Atualize preço, descrição e status do produto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function EditProductPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(productQueryOptions(id));
  const product = data.product;

  const [form, setForm] = useState({
    name: product.name ?? "",
    sku: product.sku ?? "",
    description: product.description ?? "",
    commercial_description: product.commercial_description ?? "",
    technical_description: product.technical_description ?? "",
    dimensions: product.dimensions ?? "",
    weight: product.weight ?? "",
    price: String(product.price ?? 0),
    active: product.active ?? true,
  });
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    update.mutate({
      data: {
        id,
        ...form,
        price: Number(form.price),
        specifications: (product.specifications as { label: string; value: string }[]) ?? [],
      },
    });
  };

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
                Esta ação remove o produto e seus anexos permanentemente.
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
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="commercial_description">Descrição comercial</Label>
              <Input
                id="commercial_description"
                value={form.commercial_description}
                onChange={(e) => setForm({ ...form, commercial_description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="technical_description">Descrição técnica</Label>
              <Input
                id="technical_description"
                value={form.technical_description}
                onChange={(e) => setForm({ ...form, technical_description: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="dimensions">Dimensões</Label>
                <Input
                  id="dimensions"
                  value={form.dimensions}
                  onChange={(e) => setForm({ ...form, dimensions: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight">Peso</Label>
                <Input
                  id="weight"
                  value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Preço *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="active"
                checked={form.active}
                onCheckedChange={(checked) => setForm({ ...form, active: checked === true })}
              />
              <Label htmlFor="active" className="font-normal">
                Produto ativo
              </Label>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={update.isPending}>
              {update.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
