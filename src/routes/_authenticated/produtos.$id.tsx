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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  INTEGRATION_CATEGORIES,
  INTEGRATION_CONNECTION_STATUSES,
  INTEGRATION_SYSTEMS,
  formatDateTime,
} from "@/lib/commercial-constants";

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
  notFoundComponent: () => <p>Integração não encontrada.</p>,
  head: () => ({
    meta: [
      { title: "Editar integração - Nexus 360" },
      {
        name: "description",
        content: "Atualize sistema, categoria, status da conexão e registros sincronizados.",
      },
      { property: "og:title", content: "Editar integração - Nexus 360" },
      {
        property: "og:description",
        content: "Gerencie a conexão com sistemas corporativos no Nexus 360.",
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

  const [form, setForm] = useState({
    name: integration.name ?? "",
    description: integration.description ?? "",
    category: integration.category ?? "",
    code: integration.code ?? "pendente",
    stock: String(integration.stock ?? 0),
    active: integration.active ?? true,
  });
  const [error, setError] = useState<string | null>(null);

  const update = useMutation({
    mutationFn: updateProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      toast.success("Integração atualizada.");
      navigate({ to: "/produtos" });
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Erro ao atualizar integração.";
      setError(message);
      toast.error(message);
    },
  });

  const remove = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Integração excluída.");
      navigate({ to: "/produtos" });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Erro ao excluir integração."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    update.mutate({
      data: {
        id,
        name: form.name,
        description: form.description,
        category: form.category,
        code: form.code,
        stock: Number(form.stock || 0),
        active: form.active,
        price: Number(integration.price ?? 0),
        margin_percent: Number(integration.margin_percent ?? 0),
        specifications: (integration.specifications as { label: string; value: string }[]) ?? [],
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
              <AlertDialogTitle>Excluir integração?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação remove a conexão com o sistema permanentemente.
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
          <CardTitle>Editar integração</CardTitle>
          <p className="text-sm text-muted-foreground">
            Última sincronização: {formatDateTime(integration.updated_at)}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Sistema *</Label>
              <Select
                value={form.name || undefined}
                onValueChange={(v) => setForm({ ...form, name: v })}
              >
                <SelectTrigger id="name">
                  <SelectValue placeholder="Selecione o sistema" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(new Set([...INTEGRATION_SYSTEMS, form.name].filter(Boolean))).map(
                    (s) => (
                      <SelectItem key={s} value={s as string}>
                        {s}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Select
                  value={form.category || undefined}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(
                      new Set([...INTEGRATION_CATEGORIES, form.category].filter(Boolean)),
                    ).map((c) => (
                      <SelectItem key={c} value={c as string}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Status da conexão</Label>
                <Select value={form.code} onValueChange={(v) => setForm({ ...form, code: v })}>
                  <SelectTrigger id="code">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTEGRATION_CONNECTION_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock">Registros sincronizados</Label>
              <Input
                id="stock"
                type="number"
                min="0"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Observações da integração</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="active"
                checked={form.active}
                onCheckedChange={(checked) => setForm({ ...form, active: checked === true })}
              />
              <Label htmlFor="active" className="font-normal">
                Integração ativa
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
