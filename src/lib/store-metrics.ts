/** Quanto falta vender para cobrir as despesas fixas do mês. */
export function breakEven(p: { fixedExpenses: number; profit: number; revenue: number }) {
  const missingProfit = Math.max(0, Math.round((p.fixedExpenses - p.profit) * 100) / 100);
  const avgMargin = p.revenue > 0 ? p.profit / p.revenue : 0;
  const missingRevenue = missingProfit > 0 && avgMargin > 0 ? Math.round((missingProfit / avgMargin) * 100) / 100 : null;
  const coveredPercent = p.fixedExpenses > 0 ? Math.min(100, Math.max(0, (p.profit / p.fixedExpenses) * 100)) : 100;
  return { missingProfit, missingRevenue, avgMarginPercent: Math.round(avgMargin * 10000) / 100, coveredPercent, covered: missingProfit === 0 };
}

export const EXPENSE_CATEGORIES = ["Aluguel", "Internet", "Energia", "Embalagens", "Marketing", "Pró-labore", "Outro"] as const;
