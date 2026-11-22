import { countStock, type StockCount } from "@/lib/stock";

/**
 * Recalcula o estoque pelas entradas e saídas e grava no produto.
 * Só para produtos que têm compra recebida lançada (os demais mantêm o estoque digitado).
 */
export async function recountStock(supabase: any): Promise<Map<string, StockCount>> {
  const [ins, outs] = await Promise.all([
    supabase
      .from("purchase_items")
      .select("product_id, quantity, purchases(status)")
      .not("product_id", "is", null),
    supabase.from("order_items").select("product_id, quantity, orders(status)"),
  ]);
  if (ins.error || outs.error) return new Map();
  const counts = countStock([
    ...(ins.data ?? []).map((r: any) => ({
      product_id: r.product_id,
      quantity: r.quantity,
      status: r.purchases?.status,
      kind: "in" as const,
    })),
    ...(outs.data ?? []).map((r: any) => ({
      product_id: r.product_id,
      quantity: r.quantity,
      status: r.orders?.status,
      kind: "out" as const,
    })),
  ]);
  const withPurchase = [...counts.entries()].filter(([, c]) => c.entradas > 0);
  if (!withPurchase.length) return counts;
  const { data: prods } = await supabase
    .from("products")
    .select("id, stock")
    .in(
      "id",
      withPurchase.map(([id]) => id),
    );
  for (const p of prods ?? []) {
    const c = counts.get(p.id)!;
    if (Number(p.stock ?? 0) !== c.estoque) {
      await supabase.from("products").update({ stock: c.estoque }).eq("id", p.id);
    }
  }
  return counts;
}
