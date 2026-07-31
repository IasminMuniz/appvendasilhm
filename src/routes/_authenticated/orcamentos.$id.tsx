import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Check, Download, Mail, ShoppingCart, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  convertQuoteToOrder,
  decideQuote,
  generateQuotePdf,
  getQuote,
  sendQuoteEmail,
  submitQuote,
} from "@/lib/quotes.functions";
import { QUOTE_STATUS_LABELS, formatCurrency } from "@/lib/commercial-constants";

const quoteQueryOptions = (id: string) =>
  queryOptions({ queryKey: ["quotes", id], queryFn: () => getQuote({ data: { id } }) });

export const Route = createFileRoute("/_authenticated/orcamentos/$id")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(quoteQueryOptions(params.id)),
  component: QuoteDetailPage,
  head: () => ({
    meta: [
      { title: "Orçamento - Plataforma Comercial" },
      {
        name: "description",
        content: "Detalhes da proposta, fluxo de aprovação de desconto, PDF e envio ao cliente.",
      },
    ],
  }),
});

function QuoteDetailPage() {
  const { id } = useParams({ from: "/_authenticated/orcamentos/$id" });
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(quoteQueryOptions(id));
  const quote = data.quote;

  const [email, setEmail] = useState({
    to: quote.customers?.email ?? "",
    subject: `Orçamento #${quote.number}`,
    message: "Olá,\n\nSegue o orçamento solicitado. Ficamos à disposição.",
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["quotes"] });

  const canApprove =
    data.myRoles.includes("admin") ||
    data.myRoles.includes("gerente") ||
    data.myRoles.includes("supervisor");

  const submitMutation = useMutation({
    mutationFn: submitQuote,
    onSuccess: (res) => {
      toast.success(
        res.status === "aprovado"
          ? "Orçamento aprovado automaticamente"
          : "Enviado para aprovação superior",
      );
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decideMutation = useMutation({
    mutationFn: decideQuote,
    onSuccess: () => {
      toast.success("Decisão registrada");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const convertMutation = useMutation({
    mutationFn: convertQuoteToOrder,
    onSuccess: () => {
      toast.success("Pedido gerado");
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pdfMutation = useMutation({
    mutationFn: generateQuotePdf,
    onSuccess: (res) => {
      const link = document.createElement("a");
      link.href = `data:application/pdf;base64,${res.base64}`;
      link.download = res.fileName;
      link.click();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const emailMutation = useMutation({
    mutationFn: sendQuoteEmail,
    onSuccess: () => {
      toast.success("Orçamento enviado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" asChild>
        <Link to="/orcamentos">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orçamento #{quote.number}</h1>
          <p className="text-muted-foreground">
            {quote.customers?.company_name || quote.customers?.name} ·{" "}
            {new Date(quote.created_at).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <Badge variant="outline">{QUOTE_STATUS_LABELS[quote.status] ?? quote.status}</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {quote.status === "rascunho" && (
          <Button onClick={() => submitMutation.mutate({ data: { id } })}>
            Enviar para aprovação
          </Button>
        )}
        {quote.status === "aguardando_aprovacao" && canApprove && (
          <>
            <Button onClick={() => decideMutation.mutate({ data: { id, approve: true } })}>
              <Check className="mr-2 h-4 w-4" />
              Aprovar
            </Button>
            <Button
              variant="destructive"
              onClick={() => decideMutation.mutate({ data: { id, approve: false } })}
            >
              <X className="mr-2 h-4 w-4" />
              Reprovar
            </Button>
          </>
        )}
        {quote.status === "aprovado" && (
          <Button onClick={() => convertMutation.mutate({ data: { id } })}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            Gerar pedido
          </Button>
        )}
        <Button variant="outline" onClick={() => pdfMutation.mutate({ data: { id } })}>
          <Download className="mr-2 h-4 w-4" />
          Baixar PDF
        </Button>
        {quote.order_id && (
          <Button variant="outline" asChild>
            <Link to="/pedidos/$id" params={{ id: quote.order_id }}>
              Ver pedido
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Itens</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {quote.quote_items?.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{item.products?.name ?? "Produto"}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.quantity} x {formatCurrency(Number(item.unit_price))} ·{" "}
                    {Number(item.discount_percent ?? 0)}% desc.
                  </p>
                </div>
                <span className="font-semibold">{formatCurrency(Number(item.total))}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-1 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatCurrency(Number(quote.subtotal ?? 0))}</span>
            </div>
            <div className="flex justify-between">
              <span>Desconto geral</span>
              <span>{Number(quote.discount_percent ?? 0)}%</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>{formatCurrency(Number(quote.total ?? 0))}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {(quote.commercial_terms || quote.notes) && (
        <Card>
          <CardHeader>
            <CardTitle>Condições e observações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {quote.commercial_terms && <p>{quote.commercial_terms}</p>}
            {quote.notes && <p>{quote.notes}</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Enviar por e-mail
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              emailMutation.mutate({ data: { id, ...email } });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="to">Destinatário</Label>
              <Input
                id="to"
                type="email"
                value={email.to}
                onChange={(e) => setEmail({ ...email, to: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Assunto</Label>
              <Input
                id="subject"
                value={email.subject}
                onChange={(e) => setEmail({ ...email, subject: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Mensagem</Label>
              <Textarea
                id="message"
                value={email.message}
                onChange={(e) => setEmail({ ...email, message: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={emailMutation.isPending}>
              {emailMutation.isPending ? "Enviando..." : "Enviar orçamento"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aprovações</CardTitle>
        </CardHeader>
        <CardContent>
          {data.approvals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma solicitação registrada.</p>
          ) : (
            <div className="space-y-3">
              {data.approvals.map((a) => (
                <div key={a.id} className="border-l-2 border-primary/40 pl-3 text-sm">
                  <p className="font-medium">
                    {a.status} · {Number(a.discount_percent)}% (nível {a.required_role})
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleString("pt-BR")}
                  </p>
                  {a.note && <p className="text-xs text-muted-foreground">{a.note}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de envios</CardTitle>
        </CardHeader>
        <CardContent>
          {data.sends.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum envio registrado.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {data.sends.map((s) => (
                <div key={s.id} className="flex justify-between">
                  <span>{s.to_email}</span>
                  <span className="text-muted-foreground">
                    {s.status} · {new Date(s.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
