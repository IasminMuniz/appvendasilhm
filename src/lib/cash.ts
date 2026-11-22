/** Regras do caixa da loja: para onde vai o dinheiro de cada venda. */

export interface CashPlan {
  /** Dinheiro que você colocou do próprio bolso para começar (aporte). */
  initialCapital: number;
  /** % do valor de cada venda separado para outros fins (não é lucro). */
  otherPurposesPct: number;
  /** % do lucro de cada venda guardado como reserva de caixa (emergências, meses fracos). */
  reservePct: number;
  /** % do lucro de cada venda para crescer: comprar mais peças além da reposição. */
  growthPct: number;
}

export const DEFAULT_CASH_PLAN: CashPlan = {
  initialCapital: 0,
  otherPurposesPct: 10,
  reservePct: 20,
  growthPct: 30,
};

export interface PaidSale {
  total: number;
  channel_fee: number;
  other_costs: number;
  product_cost: number;
  packaging_cost: number;
}

export interface SaleSplit {
  /** Valor bruto vendido. */
  revenue: number;
  /** Taxas e custos já pagos na venda (canal, anúncios, frete...). */
  fees: number;
  /** Repõe exatamente o que as peças vendidas custaram. */
  restock: number;
  /** Repõe as embalagens usadas. */
  packaging: number;
  /** Separado para outros fins (% da venda). */
  otherPurposes: number;
  /** Reserva de caixa (% do lucro). */
  reserve: number;
  /** Para crescer o estoque (% do lucro). */
  growth: number;
  /** O que sobra para você (seu lucro livre). */
  ownerProfit: number;
  /** Lucro da venda antes da divisão. */
  profit: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Divide o dinheiro das vendas pagas entre os "potes" do caixa. */
export function splitSales(sales: PaidSale[], plan: CashPlan): SaleSplit {
  const sum = (f: (s: PaidSale) => number) => sales.reduce((t, s) => t + (Number(f(s)) || 0), 0);
  const revenue = sum((s) => s.total);
  const fees = sum((s) => s.channel_fee) + sum((s) => s.other_costs);
  const restock = sum((s) => s.product_cost);
  const packaging = sum((s) => s.packaging_cost);
  const profit = revenue - fees - restock - packaging;
  const otherPurposes = Math.max(0, revenue * (plan.otherPurposesPct / 100));
  const afterOther = profit - otherPurposes;
  const base = Math.max(0, afterOther);
  const reserve = base * (plan.reservePct / 100);
  const growth = base * (plan.growthPct / 100);
  const ownerProfit = afterOther - reserve - growth;
  return {
    revenue: r2(revenue),
    fees: r2(fees),
    restock: r2(restock),
    packaging: r2(packaging),
    otherPurposes: r2(otherPurposes),
    reserve: r2(reserve),
    growth: r2(growth),
    ownerProfit: r2(ownerProfit),
    profit: r2(profit),
  };
}

/** Valida e completa um plano salvo. */
export function normalizePlan(raw: unknown): CashPlan {
  const o = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof CashPlan, unknown>>;
  const num = (v: unknown, d: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : d;
  };
  return {
    initialCapital: num(o.initialCapital, DEFAULT_CASH_PLAN.initialCapital, 10_000_000),
    otherPurposesPct: num(o.otherPurposesPct, DEFAULT_CASH_PLAN.otherPurposesPct, 100),
    reservePct: num(o.reservePct, DEFAULT_CASH_PLAN.reservePct, 100),
    growthPct: num(o.growthPct, DEFAULT_CASH_PLAN.growthPct, 100),
  };
}
