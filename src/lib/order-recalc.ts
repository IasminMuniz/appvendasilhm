import { profitOf } from "@/lib/sales";

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
