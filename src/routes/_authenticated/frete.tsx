import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Truck } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { maskCep } from "@/lib/masks";
import {
  cotarFrete,
  dadosEnvioDaVenda,
  enviarParaMelhorEnvio,
  getFreightSettings,
  saveFreightSettings,
  usarFreteNaVenda,
  type Sender,
} from "@/lib/freight.functions";
import { freightSummary, splitAddress, type FreightQuote } from "@/lib/freight";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency } from "@/lib/commercial-constants";
import { listOrders } from "@/lib/orders.functions";
import { saleCode } from "@/lib/sales";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/frete")({
  validateSearch: z.object({
    cep: z.string().optional(),
    valor: z.coerce.number().optional(),
    pedido: z.string().uuid().optional(),
  }),
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

const EMPTY_SENDER: Sender = {
  name: "",
  document: "",
  phone: "",
  address: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
};
const SENDER_FIELDS: [keyof Sender, string, string][] = [
  ["name", "Nome do remetente", "Seu nome ou nome da loja"],
  ["document", "CPF ou CNPJ", "Só números"],
  ["phone", "Telefone", "(11) 90000-0000"],
  ["address", "Rua", ""],
  ["number", "Número", ""],
  ["complement", "Complemento", "Opcional"],
  ["district", "Bairro", ""],
  ["city", "Cidade", ""],
  ["state", "UF", "SP"],
];

type Dest = {
  name: string;
  document: string;
  phone: string;
  email: string;
  address: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  postal_code: string;
};
const DEST_FIELDS: [keyof Dest, string][] = [
  ["name", "Nome da cliente"],
  ["document", "CPF da cliente"],
  ["phone", "Telefone"],
  ["email", "E-mail"],
  ["postal_code", "CEP"],
  ["address", "Rua"],
  ["number", "Número"],
  ["complement", "Complemento"],
  ["district", "Bairro"],
  ["city", "Cidade"],
  ["state", "UF"],
];

function FretePage() {
  const search = Route.useSearch();
  const [cep, setCep] = useState(maskCep(search.cep ?? ""));
  const [peso, setPeso] = useState("0,3");
  const [alt, setAlt] = useState("5");
  const [larg, setLarg] = useState("20");
  const [comp, setComp] = useState("25");
  const [valor, setValor] = useState(search.valor ? String(search.valor).replace(".", ",") : "");
  const [quotes, setQuotes] = useState<FreightQuote[]>([]);
  const [escolhido, setEscolhido] = useState<FreightQuote | null>(null);
  // Venda que recebe o frete: a de origem (botão na venda) ou escolhida aqui.
  const [vendaEscolhida, setVendaEscolhida] = useState("");
  const pedidoId = search.pedido ?? vendaEscolhida;
  const vendas = useQuery({
    queryKey: ["orders"],
    queryFn: () => listOrders(),
    enabled: !!escolhido && !search.pedido,
  });
  const vendasAbertas = (vendas.data ?? []).filter((o) => o.status !== "cancelado");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Etiqueta no Melhor Envio: depois de lançar o frete, coloca o envio no carrinho de lá.
  const [mandarME, setMandarME] = useState(true);
  const [etiqueta, setEtiqueta] = useState<{ order_id: string; quote: FreightQuote } | null>(null);
  const [dest, setDest] = useState<Dest | null>(null);
  const cliente = useQuery({
    queryKey: ["dados-envio", etiqueta?.order_id],
    queryFn: () => dadosEnvioDaVenda({ data: { order_id: etiqueta!.order_id } }),
    enabled: !!etiqueta,
  });
  useEffect(() => {
    if (!etiqueta || !cliente.data) return;
    const c = cliente.data;
    const a = splitAddress(c.address);
    setDest({
      name: c.name,
      document: c.document,
      phone: c.phone,
      email: c.email,
      address: a.street,
      number: a.number,
      complement: a.complement,
      district: a.district,
      city: c.city,
      state: c.state.slice(0, 2).toUpperCase(),
      postal_code: maskCep(c.postal_code || cep),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etiqueta, cliente.data]);

  const enviarME = useMutation({
    mutationFn: () =>
      enviarParaMelhorEnvio({
        data: {
          order_id: etiqueta!.order_id,
          service_id: etiqueta!.quote.service_id!,
          package: { height: num(alt), width: num(larg), length: num(comp), weight: num(peso) },
          insurance_value: valor ? num(valor) : (cliente.data?.total ?? 0),
          to: dest!,
        },
      }),
    onSuccess: () => {
      const id = etiqueta!.order_id;
      toast.success(
        "Envio colocado no carrinho do Melhor Envio. Agora é só pagar e imprimir a etiqueta lá.",
      );
      setEtiqueta(null);
      setDest(null);
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      navigate({ to: "/pedidos/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const aplicar = useMutation({
    mutationFn: (quem_paga: "loja" | "cliente") =>
      usarFreteNaVenda({
        data: {
          order_id: pedidoId,
          transportadora: escolhido!.transportadora,
          servico: escolhido!.servico,
          preco: escolhido!.preco,
          prazo_dias: escolhido!.prazo_dias,
          quem_paga,
        },
      }),
    onSuccess: () => {
      toast.success("Frete lançado na venda");
      const quote = escolhido;
      setEscolhido(null);
      queryClient.invalidateQueries({ queryKey: ["order", pedidoId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (mandarME && quote?.service_id) {
        setDest(null);
        setEtiqueta({ order_id: pedidoId, quote });
      } else navigate({ to: "/pedidos/$id", params: { id: pedidoId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const settings = useQuery({
    queryKey: ["freight-settings"],
    queryFn: () => getFreightSettings(),
  });
  const [origin, setOrigin] = useState("");
  const [email, setEmail] = useState("");
  const [sender, setSender] = useState<Sender>(EMPTY_SENDER);
  useEffect(() => {
    if (settings.data) {
      setOrigin(maskCep(settings.data.origin_cep));
      setEmail(settings.data.contact_email);
      setSender({ ...EMPTY_SENDER, ...settings.data.sender });
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () =>
      saveFreightSettings({
        data: {
          origin_cep: origin,
          contact_email: email,
          sender: { ...sender, state: sender.state.toUpperCase().slice(0, 2) },
        },
      }),
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
        <p className="text-muted-foreground">
          Cotação pelo Melhor Envio. Toque em &quot;Usar este frete&quot; para lançar a opção na
          venda.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuração da loja</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>CEP de origem da loja</Label>
            <Input
              value={origin}
              onChange={(e) => setOrigin(maskCep(e.target.value))}
              placeholder="00000-000"
            />
          </div>
          <div className="space-y-1">
            <Label>E-mail de contato (Melhor Envio)</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="sm:col-span-3">
            <p className="text-sm font-medium">Remetente (vai na etiqueta)</p>
            <p className="text-xs text-muted-foreground">
              Preencha uma vez. É usado quando você manda o envio para o Melhor Envio.
            </p>
          </div>
          {SENDER_FIELDS.map(([k, label, ph]) => (
            <div key={k} className="space-y-1">
              <Label htmlFor={`s_${k}`}>{label}</Label>
              <Input
                id={`s_${k}`}
                value={sender[k]}
                placeholder={ph}
                maxLength={k === "state" ? 2 : undefined}
                onChange={(e) => setSender({ ...sender, [k]: e.target.value })}
              />
            </div>
          ))}
          <div className="flex items-end sm:col-span-3">
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
              <Input
                value={cep}
                onChange={(e) => setCep(maskCep(e.target.value))}
                placeholder="00000-000"
                required
              />
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
                  {q.logo && (
                    <img src={q.logo} alt={q.transportadora} className="h-10 w-16 object-contain" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{q.transportadora}</p>
                    <p className="text-sm text-muted-foreground">{q.servico}</p>
                    {q.prazo_dias != null && (
                      <p className="text-sm text-muted-foreground">{q.prazo_dias} dia(s) úteis</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className="text-lg font-bold">{formatCurrency(q.preco)}</p>
                    <Button size="sm" onClick={() => setEscolhido(q)}>
                      <Check className="mr-1 h-4 w-4" />
                      Usar este frete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      <Dialog open={!!escolhido} onOpenChange={(o) => !o && setEscolhido(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quem paga o frete?</DialogTitle>
            <DialogDescription>
              {escolhido &&
                `${escolhido.transportadora} ${escolhido.servico} – ${formatCurrency(escolhido.preco)}`}
            </DialogDescription>
          </DialogHeader>
          {!search.pedido && (
            <div className="space-y-2">
              <Label htmlFor="venda">Em qual venda?</Label>
              <Select value={vendaEscolhida || undefined} onValueChange={setVendaEscolhida}>
                <SelectTrigger id="venda">
                  <SelectValue
                    placeholder={vendas.isLoading ? "Carregando vendas..." : "Selecione a venda"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {vendasAbertas.map((o, i) => (
                    <SelectItem key={o.id} value={o.id}>
                      {saleCode(o.order_number ?? vendasAbertas.length - i)} ·{" "}
                      {o.customers?.name ?? "Cliente"} · {formatCurrency(Number(o.total ?? 0))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!vendas.isLoading && vendasAbertas.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhuma venda aberta. Lance a venda primeiro em Vendas.
                </p>
              )}
            </div>
          )}
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">A cliente paga:</strong> o frete fica anotado na
              venda e não muda o lucro (o valor só passa por você).
            </p>
            <p>
              <strong className="text-foreground">Por minha conta:</strong> o frete entra em Outros
              custos e é descontado do lucro (frete grátis).
            </p>
          </div>
          {escolhido?.service_id && (
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={mandarME}
                onCheckedChange={(c) => setMandarME(c === true)}
                className="mt-0.5"
              />
              <span>
                Também mandar este envio para o Melhor Envio
                <span className="block text-xs text-muted-foreground">
                  Os dados da cliente e do pacote vão sozinhos. Lá você só paga e imprime a
                  etiqueta.
                </span>
              </span>
            </label>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              disabled={aplicar.isPending || !pedidoId}
              onClick={() => aplicar.mutate("loja")}
            >
              Por minha conta
            </Button>
            <Button
              disabled={aplicar.isPending || !pedidoId}
              onClick={() => aplicar.mutate("cliente")}
            >
              A cliente paga
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!etiqueta}
        onOpenChange={(o) => {
          if (!o && etiqueta) {
            const id = etiqueta.order_id;
            setEtiqueta(null);
            navigate({ to: "/pedidos/$id", params: { id } });
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mandar para o Melhor Envio</DialogTitle>
            <DialogDescription>
              {etiqueta &&
                `${etiqueta.quote.transportadora} ${etiqueta.quote.servico} – ${formatCurrency(etiqueta.quote.preco)}. `}
              Confira os dados da cliente para a etiqueta.
            </DialogDescription>
          </DialogHeader>
          {!dest ? (
            <p className="text-sm text-muted-foreground">Carregando dados da cliente...</p>
          ) : (
            <form
              id="form-etiqueta"
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                enviarME.mutate();
              }}
            >
              {DEST_FIELDS.map(([k, label]) => (
                <div key={k} className={k === "address" ? "space-y-1 sm:col-span-2" : "space-y-1"}>
                  <Label htmlFor={`d_${k}`}>{label}</Label>
                  <Input
                    id={`d_${k}`}
                    value={dest[k]}
                    maxLength={k === "state" ? 2 : undefined}
                    onChange={(e) =>
                      setDest({
                        ...dest,
                        [k]: k === "postal_code" ? maskCep(e.target.value) : e.target.value,
                      })
                    }
                  />
                </div>
              ))}
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Pacote: {peso} kg, {alt} × {larg} × {comp} cm. Vai com declaração de conteúdo (sem
                nota fiscal).
              </p>
            </form>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                const id = etiqueta!.order_id;
                setEtiqueta(null);
                navigate({ to: "/pedidos/$id", params: { id } });
              }}
            >
              Agora não
            </Button>
            <Button type="submit" form="form-etiqueta" disabled={!dest || enviarME.isPending}>
              {enviarME.isPending ? "Enviando..." : "Mandar para o Melhor Envio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
