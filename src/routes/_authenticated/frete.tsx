import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Truck } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { maskCep } from "@/lib/masks";
import { cotarFrete, getFreightSettings, saveFreightSettings } from "@/lib/freight.functions";
import { freightSummary, type FreightQuote } from "@/lib/freight";
import { formatCurrency } from "@/lib/commercial-constants";

export const Route = createFileRoute("/_authenticated/frete")({
  validateSearch: z.object({ cep: z.string().optional(), valor: z.coerce.number().optional() }),
  head: () => ({
    meta: [
      { title: "Cotar Frete | Nexus 360" },
      { name: "description", content: "Cote frete no Melhor Envio para suas clientes." },
      { property: "og:title", content: "Cotar Frete | Nexus 360" },
      { property: "og:description", content: "Cote frete no Melhor Envio para suas clientes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FretePage,
});

const num = (s: string) => Number(s.replace(",", "."));

function FretePage() {
  const search = Route.useSearch();
  const [cep, setCep] = useState(maskCep(search.cep ?? ""));
  const [peso, setPeso] = useState("0,3");
  const [alt, setAlt] = useState("5");
  const [larg, setLarg] = useState("20");
  const [comp, setComp] = useState("25");
  const [valor, setValor] = useState(search.valor ? String(search.valor).replace(".", ",") : "");
  const [quotes, setQuotes] = useState<FreightQuote[]>([]);

  const settings = useQuery({ queryKey: ["freight-settings"], queryFn: () => getFreightSettings() });
  const [origin, setOrigin] = useState("");
  const [email, setEmail] = useState("");
  useEffect(() => {
    if (settings.data) {
      setOrigin(maskCep(settings.data.origin_cep));
      setEmail(settings.data.contact_email);
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () => saveFreightSettings({ data: { origin_cep: origin, contact_email: email } }),
    onSuccess: () => {
      toast.success("Configuração salva");
      settings.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const quote = useMutation({
    mutationFn: () =>
      cotarFrete({
        data: {
          cep_destino: cep,
          peso_kg: num(peso),
          altura_cm: num(alt),
          largura_cm: num(larg),
          comprimento_cm: num(comp),
          ...(valor ? { valor_declarado: num(valor) } : {}),
        },
      }),
    onSuccess: (r) => setQuotes(r.quotes),
    onError: (e: Error) => {
      setQuotes([]);
      toast.error(e.message);
    },
  });

  const copy = async () => {
    await navigator.clipboard.writeText(freightSummary(cep, quotes));
    toast.success("Resumo copiado! É só colar na conversa com a cliente.");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cotar Frete</h1>
        <p className="text-muted-foreground">Cotação pelo Melhor Envio.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuração da loja</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>CEP de origem da loja</Label>
            <Input value={origin} onChange={(e) => setOrigin(maskCep(e.target.value))} placeholder="00000-000" />
          </div>
          <div className="space-y-1">
            <Label>E-mail de contato (Melhor Envio)</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => save.mutate()} disabled={save.isPending}>
              Salvar configuração
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pacote e destino</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              quote.mutate();
            }}
          >
            <div className="space-y-1">
              <Label>CEP de destino</Label>
              <Input value={cep} onChange={(e) => setCep(maskCep(e.target.value))} placeholder="00000-000" required />
            </div>
            <div className="space-y-1">
              <Label>Peso (kg)</Label>
              <Input value={peso} onChange={(e) => setPeso(e.target.value)} inputMode="decimal" />
            </div>
            <div className="space-y-1">
              <Label>Valor declarado (R$, opcional)</Label>
              <Input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" />
            </div>
            <div className="space-y-1">
              <Label>Altura (cm)</Label>
              <Input value={alt} onChange={(e) => setAlt(e.target.value)} inputMode="decimal" />
            </div>
            <div className="space-y-1">
              <Label>Largura (cm)</Label>
              <Input value={larg} onChange={(e) => setLarg(e.target.value)} inputMode="decimal" />
            </div>
            <div className="space-y-1">
              <Label>Comprimento (cm)</Label>
              <Input value={comp} onChange={(e) => setComp(e.target.value)} inputMode="decimal" />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={quote.isPending}>
                <Truck className="mr-2 h-4 w-4" />
                {quote.isPending ? "Cotando..." : "Cotar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {quotes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Resultados</h2>
            <Button variant="outline" onClick={copy}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar resumo para a cliente
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {quotes.map((q, i) => (
              <Card key={i}>
                <CardContent className="flex items-center gap-3 p-4">
                  {q.logo && <img src={q.logo} alt={q.transportadora} className="h-10 w-16 object-contain" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{q.transportadora}</p>
                    <p className="text-sm text-muted-foreground">{q.servico}</p>
                    {q.prazo_dias != null && (
                      <p className="text-sm text-muted-foreground">{q.prazo_dias} dia(s) úteis</p>
                    )}
                  </div>
                  <p className="text-lg font-bold">{formatCurrency(q.preco)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
