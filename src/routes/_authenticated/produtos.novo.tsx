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
import {
  INTEGRATION_CATEGORIES,
  INTEGRATION_CONNECTION_STATUSES,
  INTEGRATION_SYSTEMS,
} from "@/lib/commercial-constants";
import { createProduct } from "@/lib/products.functions";

export const Route = createFileRoute("/_authenticated/produtos/novo")({
  component: NewIntegrationPage,
  head: () => ({
    meta: [
      { title: "Nova integração - Nexus 360" },
      {
        name: "description",
        content: "Cadastre uma conexão com sistemas corporativos como Salesforce, SAP ou TOTVS.",
      },
      { property: "og:title", content: "Nova integração - Nexus 360" },
      {
        property: "og:description",
        content: "Cadastre uma conexão com sistemas corporativos no Nexus 360.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function NewIntegrationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "",
    code: "pendente",
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
      setError(err instanceof Error ? err.message : "Erro ao criar integração.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    mutation.mutate({
      data: {
        name: form.name,
        description: form.description,
        price: 0,
        category: form.category,
        code: form.code,
        margin_percent: 0,
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
          <CardTitle>Nova integração</CardTitle>
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
                  {INTEGRATION_SYSTEMS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
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
                    {INTEGRATION_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
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
                Produto ativo
              </Label>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : "Salvar integração"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
