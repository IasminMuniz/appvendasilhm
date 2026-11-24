import { useState } from "react";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, RotateCcw, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/commercial-constants";
import { buildInstallments, paymentSummary } from "@/lib/payments";
import { SALE_PAYMENT_METHODS } from "@/lib/sales";
import {
  listOrderPayments,
  resetOrderPayments,
  setOrderPaymentPaid,
  updateOrderPayment,
} from "@/lib/payments.functions";

const today = () => new Date().toISOString().slice(0, 10);
const INSTALLMENT_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1));

export interface PaymentPlanValues {
  installments: string;
  first_due_date: string;
  first_paid: boolean;
}

export const emptyPaymentPlan = (): PaymentPlanValues => ({
  installments: "1",
  first_due_date: today(),
  first_paid: true,
});

export const toPaymentPlanInput = (v: PaymentPlanValues) => ({
  installments: Number(v.installments || 1),
  first_due_date: v.first_due_date,
  first_paid: v.first_paid,
});

/** Campos "em quantas vezes / quando / já recebeu" com a prévia das parcelas. */
export function PaymentPlanFields({
  value,
  onChange,
  total,
  method,
}: {
  value: PaymentPlanValues;
  onChange: (v: PaymentPlanValues) => void;
  total: number;
  method?: string;
}) {
  const set = (patch: Partial<PaymentPlanValues>) => onChange({ ...value, ...patch });
  const n = Number(value.installments || 1);
  const rows = buildInstallments({
    total,
    installments: n,
    firstDate: value.first_due_date || today(),
    firstPaid: value.first_paid,
    method,
  });

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-sm font-medium">Pagamento da cliente</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="installments">Em quantas vezes</Label>
          <Select value={value.installments} onValueChange={(v) => set({ installments: v })}>
            <SelectTrigger id="installments">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INSTALLMENT_OPTIONS.map((o) => (
                <SelectItem key={o} value={o}>
                  {o === "1" ? "À vista (1x)" : `${o}x`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="first_due">{n > 1 ? "Data da 1ª parcela" : "Data do pagamento"}</Label>
          <Input
            id="first_due"
            type="date"
            value={value.first_due_date}
            onChange={(e) => set({ first_due_date: e.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 pt-7 text-sm">
          <Checkbox
            checked={value.first_paid}
            onCheckedChange={(c) => set({ first_paid: c === true })}
          />
          {n > 1 ? "Já recebi a 1ª parcela" : "Já recebi"}
        </label>
      </div>
      {total > 0 && (
        <ul className="space-y-1 text-sm">
          {rows.map((r) => (
            <li key={r.number} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">
                {n > 1 ? `${r.number}ª parcela · ` : ""}
                {formatDate(r.due_date)}
              </span>
              <span className="flex items-center gap-2">
                {formatCurrency(r.amount)}
                <Badge variant={r.status === "Pago" ? "default" : "secondary"}>
                  {r.status === "Pago" ? "Recebido" : "A receber"}
                </Badge>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        As parcelas vencem uma a cada mês. Lance a data em que <strong>você</strong> recebe o
        dinheiro (no cartão parcelado pela maquininha, use a data em que a maquininha repassa).
      </p>
    </div>
  );
}

export const orderPaymentsQuery = (orderId: string) =>
  queryOptions({
    queryKey: ["order-payments", orderId],
    queryFn: () => listOrderPayments({ data: { orderId } }),
  });

type PaymentRow = {
  id: string;
  number: number;
  due_date: string;
  amount: number;
  method: string | null;
  status: string;
  paid_at: string | null;
  notes: string | null;
};

/** Cartão da venda com as parcelas: marcar recebido, editar data/valor e refazer o parcelamento. */
export function OrderPaymentsCard({
  orderId,
  total,
  method,
}: {
  orderId: string;
  total: number;
  method: string | null;
}) {
  const qc = useQueryClient();
  const { data } = useQuery(orderPaymentsQuery(orderId));
  const [redo, setRedo] = useState<null | (PaymentPlanValues & { method: string })>(null);
  const [editing, setEditing] = useState<null | PaymentRow>(null);

  const refresh = () => {
    for (const k of [["order-payments", orderId], ["cash-flow"], ["orders"]])
      qc.invalidateQueries({ queryKey: k });
  };
  const onError = (e: Error) => toast.error(e.message);
  const togglePaid = useMutation({
    mutationFn: (v: { id: string; paid: boolean }) =>
      setOrderPaymentPaid({ data: { ...v, paid_at: today() } }),
    onSuccess: refresh,
    onError,
  });
  const reset = useMutation({
    mutationFn: (v: PaymentPlanValues & { method: string }) =>
      resetOrderPayments({ data: { orderId, method: v.method, ...toPaymentPlanInput(v) } }),
    onSuccess: () => {
      refresh();
      setRedo(null);
      toast.success("Parcelas atualizadas.");
    },
    onError,
  });
  const save = useMutation({
    mutationFn: (p: PaymentRow) =>
      updateOrderPayment({
        data: {
          id: p.id,
          due_date: p.due_date,
          amount: Number(p.amount),
          method: p.method ?? "",
          notes: p.notes ?? "",
        },
      }),
    onSuccess: () => {
      refresh();
      setEditing(null);
    },
    onError,
  });

  if (!data) return null;
  const payments = data.payments as PaymentRow[];
  const s = paymentSummary(payments, today());

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Pagamento da cliente</CardTitle>
        {!data.migrationPending && !redo && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setRedo({
                ...emptyPaymentPlan(),
                installments: String(Math.max(1, payments.length)),
                first_due_date: payments[0]?.due_date ?? today(),
                first_paid: payments[0]?.status === "Pago",
                method: method ?? "",
              })
            }
          >
            <RotateCcw className="mr-1 h-4 w-4" />
            {payments.length ? "Mudar parcelamento" : "Lançar pagamento"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {data.migrationPending ? (
          <p className="text-sm text-muted-foreground">
            Para controlar parcelas, peça no chat do Lovable: "Aplique no banco as migrations
            pendentes da pasta drizzle/migrations".
          </p>
        ) : (
          <>
            {payments.length > 0 && (
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="default">Recebido {formatCurrency(s.received)}</Badge>
                {s.toReceive > 0 && (
                  <Badge variant="secondary">A receber {formatCurrency(s.toReceive)}</Badge>
                )}
                {s.overdue > 0 && <Badge variant="destructive">{s.overdue} atrasada(s)</Badge>}
              </div>
            )}

            {redo && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Forma de pagamento</Label>
                  <Select
                    value={redo.method || undefined}
                    onValueChange={(v) => setRedo({ ...redo, method: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {SALE_PAYMENT_METHODS.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <PaymentPlanFields
                  value={redo}
                  onChange={(v) => setRedo({ ...redo, ...v })}
                  total={total}
                  method={redo.method}
                />
                {payments.some((p) => p.status === "Pago") && (
                  <p className="text-xs text-destructive">
                    Atenção: as parcelas atuais serão substituídas por estas.
                  </p>
                )}
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => reset.mutate(redo)} disabled={reset.isPending}>
                    Salvar parcelas
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRedo(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {!redo && payments.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum pagamento lançado para esta venda.
              </p>
            )}

            {!redo && payments.length > 0 && (
              <ul className="divide-y text-sm">
                {payments.map((p) =>
                  editing?.id === p.id ? (
                    <li key={p.id} className="grid gap-2 py-2 sm:grid-cols-[1fr_8rem_auto]">
                      <Input
                        type="date"
                        value={editing.due_date}
                        onChange={(e) => setEditing({ ...editing, due_date: e.target.value })}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editing.amount}
                        onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })}
                      />
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          onClick={() => save.mutate(editing)}
                          disabled={save.isPending}
                        >
                          Salvar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </li>
                  ) : (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2"
                    >
                      <button
                        type="button"
                        className="text-left hover:opacity-80"
                        onClick={() => setEditing(p)}
                      >
                        <span className="font-medium">
                          {payments.length > 1 ? `${p.number}ª parcela` : "Pagamento"}
                        </span>{" "}
                        <span className="text-muted-foreground">
                          · vence {formatDate(p.due_date)}
                          {p.method ? ` · ${p.method}` : ""}
                          {p.paid_at ? ` · recebido em ${formatDate(p.paid_at)}` : ""}
                        </span>
                      </button>
                      <span className="flex items-center gap-2">
                        {formatCurrency(Number(p.amount))}
                        {p.status === "Pago" ? (
                          <>
                            <Badge>Recebido</Badge>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Desfazer recebimento"
                              onClick={() => togglePaid.mutate({ id: p.id, paid: false })}
                            >
                              <Undo2 className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Badge variant={p.due_date < today() ? "destructive" : "secondary"}>
                              {p.due_date < today() ? "Atrasada" : "A receber"}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => togglePaid.mutate({ id: p.id, paid: true })}
                            >
                              <Check className="mr-1 h-4 w-4" />
                              Recebi
                            </Button>
                          </>
                        )}
                      </span>
                    </li>
                  ),
                )}
              </ul>
            )}
            {!redo && payments.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Clique na parcela para mudar a data ou o valor.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
