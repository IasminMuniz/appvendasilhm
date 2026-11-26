import { effectivePackaging, profitOf } from "@/lib/sales";
import { normalizePlan } from "@/lib/cash";

/**
 * Recalcula custo dos produtos, lucro e margem das vendas (não canceladas).
 * orderIds = null → todas as vendas. reservePct = % obrigatório para outros fins.
 */
export async function recalcOrders(
  supabase: any,
  orderIds: string[] | null,
  reservePct: number,
  taxPerSale = 0,
) {
  if (orderIds && orderIds.length === 0) return;
  let q = supabase
    .from("orders")
    .select("*, order_items(quantity, products(cost))")
    .neq("status", "cancelado");
  if (orderIds) q = q.in("id", orderIds);
  const { data: orders } = await q;
  for (const o of orders ?? []) {
    const productCost =
      Math.round(
        (o.order_items ?? []).reduce(
          (s: number, i: { quantity: number; products: { cost: number } | null }) =>
            s + Number(i.quantity ?? 0) * Number(i.products?.cost ?? 0),
          0,
        ) * 100,
      ) / 100;
    const { profit, margin } = profitOf({
      total: Number(o.total ?? 0),
      channelFee: Number(o.channel_fee ?? 0),
      otherCosts: Number(o.other_costs ?? 0),
      productCost,
      packaging: effectivePackaging(o),
      reservePct,
      taxPerSale,
    });
    const { error } = await supabase
      .from("orders")
      .update({ product_cost: productCost, profit, margin_percent: margin })
      .eq("id", o.id);
    if (error) console.error("Falha ao recalcular venda", o.id, error.message);
  }
}

/** Descontos fixos de toda venda, do plano do caixa: % para outros fins e R$ para o DAS. */
export async function saleDeductionsOf(
  supabase: any,
): Promise<{ reservePct: number; taxPerSale: number }> {
  const { data, error } = await supabase
    .from("store_settings")
    .select("value")
    .eq("key", "cash_plan")
    .maybeSingle();
  const plan = normalizePlan(error ? null : data?.value);
  return { reservePct: plan.otherPurposesPct, taxPerSale: plan.taxPerSale };
}

/** % para outros fins salvo no plano do caixa (padrão 10). */
export async function reservePctOf(supabase: any): Promise<number> {
  const { data, error } = await supabase
    .from("store_settings")
    .select("value")
    .eq("key", "cash_plan")
    .maybeSingle();
  return normalizePlan(error ? null : data?.value).otherPurposesPct;
}

/** Recalcula as vendas que têm estes produtos (o custo do produto mudou). */
export async function recalcSalesForProducts(supabase: any, productIds: string[]) {
  const ids = [...new Set(productIds.filter(Boolean))];
  if (!ids.length) return;
  const { data: rows } = await supabase
    .from("order_items")
    .select("order_id")
    .in("product_id", ids);
  const orderIds = [
    ...new Set((rows ?? []).map((r: { order_id: string }) => r.order_id)),
  ] as string[];
  const d = await saleDeductionsOf(supabase);
  await recalcOrders(supabase, orderIds, d.reservePct, d.taxPerSale);
}
