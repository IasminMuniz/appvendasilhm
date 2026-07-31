import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult, jsonResult, requireAuth } from "../result";

export default defineTool({
  name: "create_order",
  title: "Criar pedido",
  description: "Cria um pedido para um cliente com um ou mais itens de produto. O total é calculado automaticamente.",
  inputSchema: {
    customer_id: z.string().uuid().describe("ID do cliente (use list_customers)."),
    notes: z.string().trim().optional().describe("Observações do pedido."),
    items: z
      .array(
        z.object({
          product_id: z.string().uuid().describe("ID do produto (use list_products)."),
          quantity: z.number().int().min(1).describe("Quantidade."),
          unit_price: z.number().min(0).optional().describe("Preço unitário; padrão é o preço do produto."),
        }),
      )
      .min(1)
      .describe("Itens do pedido."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ customer_id, notes, items }, ctx) => {
    const unauth = requireAuth(ctx);
    if (unauth) return unauth;

    const supabase = supabaseForUser(ctx);

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, price")
      .in("id", items.map((item) => item.product_id));

    if (productsError) return errorResult(productsError.message);

    const priceById = new Map((products ?? []).map((p) => [p.id, Number(p.price)]));
    const resolved = items.map((item) => {
      const unitPrice = item.unit_price ?? priceById.get(item.product_id);
      if (unitPrice === undefined) {
        throw new Error(`Produto não encontrado: ${item.product_id}`);
      }
      return { ...item, unit_price: unitPrice, total: unitPrice * item.quantity };
    });

    const total = resolved.reduce((sum, item) => sum + item.total, 0);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({ customer_id, seller_id: ctx.getUserId(), notes: notes ?? null, total })
      .select("id, status, total, created_at")
      .single();

    if (orderError) return errorResult(orderError.message);

    const { error: itemsError } = await supabase.from("order_items").insert(
      resolved.map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
      })),
    );

    if (itemsError) {
      await supabase.from("orders").delete().eq("id", order.id);
      return errorResult(itemsError.message);
    }

    return jsonResult({ ...order, items: resolved });
  },
});
