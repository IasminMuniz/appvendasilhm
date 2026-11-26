import { friendlyError } from "@/lib/error-message";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDraft } from "@/hooks/use-draft";
import { DraftNotice, PendingDraftBanner } from "@/components/draft-notice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RecordSearch, useRecordSearch } from "@/components/record-search";
import { suppliersQueryOptions } from "@/components/products/product-form";
import { deleteSupplier, saveSupplier } from "@/lib/store.functions";

export const Route = createFileRoute("/_authenticated/fornecedores")({
  loader: ({ context }) => context.queryClient.ensureQueryData(suppliersQueryOptions),
  component: SuppliersPage,
  head: () => ({
    meta: [
      { title: "Fornecedores - Nexus 360" },
      { name: "description", content: "Cadastro de fornecedores da loja com código para o SKU." },
      { property: "og:title", content: "Fornecedores - Nexus 360" },
      { property: "og:description", content: "Fornecedores da loja." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Form = {
  id?: string;
  name: string;
  address: string;
  phone: string;
  instagram: string;
  notes: string;
};
const empty = (): Form => ({ name: "", address: "", phone: "", instagram: "", notes: "" });

function SuppliersPage() {
  const { data } = useSuspenseQuery(suppliersQueryOptions);
  const search = useRecordSearch(data, (s) => [
    s.name,
    s.code,
    s.address,
    s.phone,
    s.instagram,
    s.notes,
  ]);
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  // Rascunho do cadastro novo: volta se a tela fechar antes de salvar.
  const draft = useDraft<Form>("fornecedor-novo", form && !form.id ? form : null, {
    isEmpty: (v) => JSON.stringify(v) === JSON.stringify(empty()),
  });
  const [fromDraft, setFromDraft] = useState(false);
  const openNew = () => {
    const d = draft.readDraft();
    setFromDraft(!!d);
    setForm(d ? { ...empty(), ...d } : empty());
  };
  const pending = data.some((s) => s.id === null);
  const done = () => {
    qc.invalidateQueries({ queryKey: ["suppliers"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  };
  const save = useMutation({
    mutationFn: saveSupplier,
    onSuccess: (r) => {
      done();
      if (!form?.id) draft.clear();
      setForm(null);
      toast.success(
        "code" in r && r.code ? `Fornecedor salvo com o código ${r.code}.` : "Fornecedor salvo.",
      );
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });
  const remove = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => {
      done();
      toast.success("Fornecedor excluído.");
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  return (
    <div className="space-y-6">
      {draft.hasDraft && !form && (
        <PendingDraftBanner label="um fornecedor" onContinue={openNew} onDiscard={draft.clear} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fornecedores</h1>
          <p className="text-muted-foreground">
            O código (F01, F02...) é criado sozinho e entra no SKU das peças.
          </p>
        </div>
        <Button onClick={openNew} disabled={pending}>
          <Plus className="mr-2 h-4 w-4" />
          Novo fornecedor
        </Button>
      </div>

      {pending && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Atualização do banco pendente</AlertTitle>
          <AlertDescription>
            Para cadastrar fornecedores, peça no chat do Lovable: "Aplique as migrations pendentes
            da pasta drizzle/migrations".
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>Fornecedores cadastrados</CardTitle>
          <RecordSearch
            query={search.query}
            onQueryChange={search.setQuery}
            suggestions={[]}
            placeholder="Pesquisar por nome, código, endereço, Instagram..."
          />
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {search.results.map((s) => (
              <div key={s.code} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono">
                      {s.code}
                    </Badge>
                    <p className="font-medium">{s.name}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {[s.address, s.phone, s.instagram].filter(Boolean).join(" · ") ||
                      "Sem contato cadastrado"}
                  </p>
                  {s.notes && <p className="text-sm">{s.notes}</p>}
                </div>
                {s.id && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Editar"
                      onClick={() =>
                        setForm({
                          id: s.id!,
                          name: s.name,
                          address: s.address ?? "",
                          phone: s.phone ?? "",
                          instagram: s.instagram ?? "",
                          notes: s.notes ?? "",
                        })
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Excluir"
                      onClick={() =>
                        confirm(`Excluir ${s.name}?`) && remove.mutate({ data: { id: s.id! } })
                      }
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
          </DialogHeader>
          {form && !form.id && fromDraft && (
            <DraftNotice
              onDiscard={() => {
                draft.clear();
                setFromDraft(false);
                setForm(empty());
              }}
            />
          )}
          {form && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate({ data: form });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="sn">Nome *</Label>
                <Input
                  id="sn"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sa">Endereço / local</Label>
                <Input
                  id="sa"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sp">Telefone / WhatsApp</Label>
                  <Input
                    id="sp"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="si">Instagram</Label>
                  <Input
                    id="si"
                    value={form.instagram}
                    onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="so">Observações</Label>
                <Input
                  id="so"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={save.isPending}>
                {save.isPending ? "Salvando..." : "Salvar fornecedor"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
