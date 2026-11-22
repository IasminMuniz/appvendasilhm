/** Pagamentos da cliente: parcelas, datas e o que já foi recebido. */

export const PAYMENT_STATUSES = ["Pendente", "Pago"] as const;

export interface InstallmentPlan {
  total: number;
  installments: number;
  /** Data do 1º pagamento (AAAA-MM-DD). As próximas vêm a cada mês. */
  firstDate: string;
  /** A 1ª parcela já foi recebida no ato? */
  firstPaid: boolean;
  method?: string | null;
}

export interface InstallmentRow {
  number: number;
  due_date: string;
  amount: number;
  method: string | null;
  status: "Pendente" | "Pago";
  paid_at: string | null;
}

/** Soma n meses a uma data AAAA-MM-DD, segurando o fim do mês (31/01 + 1 = 28/02). */
export function addMonthsIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

/** Divide o total em parcelas mensais; os centavos que sobram vão para a 1ª parcela. */
export function buildInstallments(plan: InstallmentPlan): InstallmentRow[] {
  const n = Math.max(1, Math.min(24, Math.floor(plan.installments || 1)));
  const cents = Math.round(plan.total * 100);
  const base = Math.floor(cents / n);
  const rest = cents - base * n;
  return Array.from({ length: n }, (_, i) => {
    const paid = i === 0 && plan.firstPaid;
    const due = addMonthsIso(plan.firstDate, i);
    return {
      number: i + 1,
      due_date: due,
      amount: (base + (i === 0 ? rest : 0)) / 100,
      method: plan.method || null,
      status: paid ? "Pago" : "Pendente",
      paid_at: paid ? due : null,
    };
  });
}

/** Resumo dos pagamentos de uma venda. */
export function paymentSummary(
  rows: { amount: number; status: string; due_date: string }[],
  today: string,
) {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const paid = rows.filter((p) => p.status === "Pago");
  const open = rows.filter((p) => p.status !== "Pago");
  return {
    count: rows.length,
    paidCount: paid.length,
    received: r2(paid.reduce((s, p) => s + Number(p.amount), 0)),
    toReceive: r2(open.reduce((s, p) => s + Number(p.amount), 0)),
    overdue: open.filter((p) => p.due_date < today).length,
    nextDue: open.map((p) => p.due_date).sort()[0] ?? null,
  };
}
