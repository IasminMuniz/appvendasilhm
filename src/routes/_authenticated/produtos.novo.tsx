import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRODUCT_CATEGORIES } from "@/lib/commercial-constants";
import { createProduct } from "@/lib/products.functions";

export const Route = createFileRoute("/_authenticated/produtos/novo")({
  component: NewProductPage,
  head: () => ({
    meta: [{ title: "Novo Produto - Vendas Comercial" }],
  }),
});

function NewProductPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "",
    code: "",
    price: "",
    margin_percent: "0",
    stock: "0",
    active: true,
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      navigate({ to: "/produtos" });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Erro ao criar produto.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    mutation.mutate({
      data: {
        name: form.name,
        description: form.description,
        price: Number(form.price),
        category: form.category,
        code: form.code,
        margin_percent: Number(form.margin_percent || 0),
        stock: Number(form.stock || 0),
        active: form.active,
      },
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" asChild>
        <Link to="/produtos">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Novo produto</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
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
                    {PRODUCT_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Código interno</Label>
                <Input
                  id="code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="margin">Margem (%)</Label>
                <Input
                  id="margin"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.margin_percent}
                  onChange={(e) => setForm({ ...form, margin_percent: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock">Estoque</Label>
                <Input
                  id="stock"
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              </div>
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

            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : "Salvar produto"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
