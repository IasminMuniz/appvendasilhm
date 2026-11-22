import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/supabase-auth.middleware";
import { z } from "zod";
import { STOCK_OUT_STATUSES, calcSale, type SaleItem } from "@/lib/sales";
import { fetchCashPlan, fetchPackagingCost } from "@/lib/store.functions";
import { profitOf, saleCode } from "@/lib/sales";
import { reservePctOf } from "@/lib/order-recalc";
import { insertOrderPayments, paymentPlanSchema } from "@/lib/payments.functions";

type LiveOrder = {
  total: number | null;
  channel_fee: number | null;
  other_costs: number | null;
  packaging_cost: number | null;
  order_items?: { quantity: number | null; products: { cost: number | null } | null }[] | null;
};

/** Custo dos produtos (custo atual do cadastro) e lucro da venda. */
function liveProfit(o: LiveOrder, reservePct: number) {
  const productCost =
    Math.round(
      (o.order_items ?? []).reduce(
        (s, i) => s + Number(i.quantity ?? 0) * Number(i.products?.cost ?? 0),
        0,
      ) * 100,
    ) / 100;
  return {
    productCost,
    ...profitOf({
      total: Number(o.total ?? 0),
      channelFee: Number(o.channel_fee ?? 0),
      otherCosts: Number(o.other_costs ?? 0),
      productCost,
      packaging: Number(o.packaging_cost ?? 0),
      reservePct,
    }),
  };
}

const orderStatusSchema = z.enum([
  "pendente",
  "em_andamento",
  "concluido",
  "cancelado",
  "criado",
  "aguardando_aprovacao",
  "aprovado",
  "processamento",
  "faturado",
  "finalizado",
  "novo",
  "entregue",
  "reservado",
  "pago",
]);

const saleInfoSchema = z.object({
  channel: z.string().max(60).optional().or(z.literal("")),
  payment_method: z.string().max(60).optional().or(z.literal("")),
  delivery_method: z.string().max(80).optional().or(z.literal("")),
  other_costs: z.coerce.number().min(0).default(0),
  other_cost_type: z.string().max(80).optional().or(z.literal("")),
  include_packaging: z.boolean().default(false),
});

type SaleInfo = z.infer<typeof saleInfoSchema>;

function saleColumns(
  info: SaleInfo,
  items: SaleItem[],
  productCost: number,
  packagingPerPiece: number,
  reservePct: number,
) {
  const r = calcSale({
    items,
    channel: info.channel,
    otherCosts: info.other_costs,
    productCost,
    packagingCost: packagingPerPiece,
    reservePct,
  });
  return {
    channel: info.channel || null,
    payment_method: info.payment_method || null,
    delivery_method: info.delivery_method || null,
    other_costs: info.other_costs,
    other_cost_type: info.other_cost_type || null,
    channel_fee: r.channelFee,
    product_cost: productCost,
    packaging_cost: r.packaging,
    profit: r.profit,
    margin_percent: r.margin,
  };
}

async function productCostOf(supabase: any, items: { product_id: string; quantity: number }[]) {
  const ids = [...new Set(items.map((i) => i.product_id))];
  if (ids.length === 0) return 0;
  const { data } = await supabase.from("products").select("id, cost").in("id", ids);
  const cost = Object.fromEntries(
    (data ?? []).map((p: { id: string; cost: number }) => [p.id, Number(p.cost ?? 0)]),
  );
  return (
    Math.round(items.reduce((s, i) => s + (cost[i.product_id] ?? 0) * i.quantity, 0) * 100) / 100
  );
}

/** Ajusta estoque dos itens da venda: sign -1 baixa, +1 devolve. */
async function adjustStock(supabase: any, orderId: string, sign: 1 | -1) {
  const { data: items } = await supabase
    .from("order_items")
    .select("product_id, quantity")
    .eq("order_id", orderId);
  for (const it of items ?? []) {
    const { data: prod } = await supabase
      .from("products")
      .select("stock")
      .eq("id", it.product_id)
      .single();
    if (!prod) continue;
    await supabase
      .from("products")
      .update({ stock: Math.max(0, Number(prod.stock ?? 0) + sign * Number(it.quantity)) })
      .eq("id", it.product_id);
  }
}

const orderItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.coerce.number().int().min(1, "Quantidade mínima é 1"),
  unit_price: z.coerce.number().min(0),
});

const createOrderSchema = saleInfoSchema.merge(paymentPlanSchema).extend({
  customer_id: z.string().uuid(),
  notes: z.string().max(2000).optional().or(z.literal("")),
  items: z.array(orderItemSchema).min(1, "Adicione pelo menos um item"),
});

export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("orders")
      .select("*, customers(name, company_name), order_items(*, products(name, cost))")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    // Lucro sempre calculado na hora, com o custo atual dos produtos e o % para outros fins.
    const reservePct = await reservePctOf(context.supabase);
    return (data ?? []).map((o) => ({ ...o, profit: liveProfit(o, reservePct).profit }));
  });

export const getOrder = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const [orderRes, historyRes, profilesRes] = await Promise.all([
      context.supabase
        .from("orders")
        .select("*, customers(*), order_items(*, products(name, cost))")
        .eq("id", data.id)
        .single(),
      context.supabase
        .from("order_status_history")
        .select("*")
        .eq("order_id", data.id)
        .order("created_at", { ascending: false }),
      context.supabase.from("profiles").select("id, full_name, email"),
    ]);

    if (orderRes.error) throw new Error(orderRes.error.message);

    const profileMap = Object.fromEntries(
      (profilesRes.data ?? []).map((p) => [p.id, p.full_name || p.email || "Usuário"]),
    );

    // Número da venda: do banco (order_number); até a migration, pela ordem de cadastro.
    let orderNumber = (orderRes.data as { order_number?: number | null }).order_number ?? null;
    if (orderNumber == null) {
      const { count } = await context.supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .lte("created_at", orderRes.data.created_at);
      orderNumber = count ?? null;
    }

    const reservePct = await reservePctOf(context.supabase);
    const live = liveProfit(orderRes.data, reservePct);

    return {
      order: { ...orderRes.data, product_cost: live.productCost, profit: live.profit },
      orderCode: orderNumber ? saleCode(orderNumber) : "",
      history: (historyRes.data ?? []).map((h) => ({
        ...h,
        changed_by_name: profileMap[h.changed_by] ?? "Usuário",
      })),
    };
  });

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => createOrderSchema.parse(data))
  .handler(async ({ data, context }) => {
    const total = data.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const productCost = await productCostOf(context.supabase, data.items);
    const packagingPerPiece = data.include_packaging
      ? await fetchPackagingCost(context.supabase)
      : 0;

    const { data: order, error: orderError } = await context.supabase
      .from("orders")
      .insert({
        customer_id: data.customer_id,
        seller_id: context.userId,
        notes: data.notes || null,
        status: "novo",
        total,
        ...saleColumns(
          data,
          data.items,
          productCost,
          packagingPerPiece,
          (await fetchCashPlan(context.supabase)).otherPurposesPct,
        ),
      })
      .select()
      .single();

    if (orderError) throw new Error(orderError.message);

    const itemsToInsert = data.items.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.quantity * item.unit_price,
    }));

    const { error: itemsError } = await context.supabase.from("order_items").insert(itemsToInsert);

    if (itemsError) {
      await context.supabase.from("orders").delete().eq("id", order.id);
      throw new Error(itemsError.message);
    }

    await context.supabase.from("order_status_history").insert({
      order_id: order.id,
      from_status: null,
      to_status: "novo",
      changed_by: context.userId,
      note: "Venda criada",
    });

    await insertOrderPayments(
      context.supabase,
      order.id,
      total,
      data.payment_method,
      data,
      context.userId,
    );

    return order;
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string; status: string; note?: string }) =>
    z
      .object({
        id: z.string().uuid(),
        status: orderStatusSchema,
        note: z.string().max(500).optional().or(z.literal("")),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: current, error: readError } = await context.supabase
      .from("orders")
      .select("status, stock_deducted")
      .eq("id", data.id)
      .single();
    if (readError) throw new Error(readError.message);

    // Baixa de estoque ao marcar como Pago (uma única vez); devolve ao cancelar/voltar.
    const shouldDeduct = STOCK_OUT_STATUSES.includes(data.status);
    let stockDeducted = current.stock_deducted;
    if (shouldDeduct && !stockDeducted) {
      await adjustStock(context.supabase, data.id, -1);
      stockDeducted = true;
    } else if (!shouldDeduct && stockDeducted) {
      await adjustStock(context.supabase, data.id, 1);
      stockDeducted = false;
    }

    const { data: order, error } = await context.supabase
      .from("orders")
      .update({ status: data.status, stock_deducted: stockDeducted })
      .eq("id", data.id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await context.supabase.from("order_status_history").insert({
      order_id: data.id,
      from_status: current.status,
      to_status: data.status,
      changed_by: context.userId,
      note: data.note || null,
    });

    const { touchCustomerActivity } = await import("@/lib/activity.server");
    await touchCustomerActivity(context.supabase, order.customer_id, context.userId);

    const { recordEvent } = await import("@/lib/events.server");
    const done = ["pago", "entregue", "faturado", "finalizado", "concluido"];
    await recordEvent(context.supabase, {
      eventType: done.includes(data.status) ? "VENDA_FECHADA" : "PEDIDO_STATUS_ALTERADO",
      entityType: "order",
      entityId: data.id,
      payload: {
        cliente_id: order.customer_id,
        valor_vendido: Number(order.total ?? 0),
        responsavel_id: order.seller_id,
        status_anterior: current.status,
        novo_status: data.status,
        alterado_por: context.userId,
        data_venda: new Date().toISOString(),
        origem: "pedido",
      },
      userId: context.userId,
    });

    return order;
  });

/** Exclui um pedido e todos os seus itens/histórico. */
export const deleteOrder = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("orders").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Atualiza canal, pagamento, entrega e outros custos, recalculando taxa, lucro e margem. */
export const updateOrderSaleInfo = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => saleInfoSchema.extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: order, error: readError } = await context.supabase
      .from("orders")
      .select("total, packaging_cost, order_items(product_id, quantity, unit_price)")
      .eq("id", data.id)
      .single();
    if (readError) throw new Error(readError.message);
    const items = (order.order_items ?? []).map((i) => ({
      unit_price: Number(i.unit_price ?? 0),
      quantity: Number(i.quantity ?? 0),
    }));
    const productCost = await productCostOf(context.supabase, order.order_items ?? []);
    // Mantém a embalagem registrada na venda (histórico); sem registro, usa a configuração atual.
    const pieces = items.reduce((s, i) => s + i.quantity, 0);
    const stored = Number(order.packaging_cost ?? 0);
    const packagingPerPiece = !data.include_packaging
      ? 0
      : stored > 0 && pieces > 0
        ? stored / pieces
        : await fetchPackagingCost(context.supabase);
    const { error } = await context.supabase
      .from("orders")
      .update(
        saleColumns(
          data,
          items,
          productCost,
          packagingPerPiece,
          (await fetchCashPlan(context.supabase)).otherPurposesPct,
        ),
      )
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
