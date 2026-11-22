import { profitOf } from "@/lib/sales";
import { normalizePlan } from "@/lib/cash";

/**
 * Recalcula custo dos produtos, lucro e margem das vendas (não canceladas).
 * orderIds = null → todas as vendas. reservePct = % obrigatório para outros fins.
 */
export async function recalcOrders(supabase: any, orderIds: string[] | null, reservePct: number) {
  if (orderIds && orderIds.length === 0) return;
  let q = supabase
    .from("orders")
    .select(
      "id, total, channel_fee, other_costs, packaging_cost, status, order_items(quantity, products(cost))",
    )
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
      packaging: Number(o.packaging_cost ?? 0),
      reservePct,
    });
    await supabase
      .from("orders")
      .update({ product_cost: productCost, profit, margin_percent: margin })
      .eq("id", o.id);
  }
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
  await recalcOrders(supabase, orderIds, await reservePctOf(supabase));
}
