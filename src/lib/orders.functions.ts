import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/supabase-auth.middleware";
import { z } from "zod";

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
]);

const orderItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.coerce.number().int().min(1, "Quantidade mínima é 1"),
  unit_price: z.coerce.number().min(0),
});

const createOrderSchema = z.object({
  customer_id: z.string().uuid(),
  notes: z.string().max(2000).optional().or(z.literal("")),
  items: z.array(orderItemSchema).min(1, "Adicione pelo menos um item"),
});

export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("orders")
      .select("*, customers(name, company_name), order_items(*, products(name))")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getOrder = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const [orderRes, historyRes, profilesRes] = await Promise.all([
      context.supabase
        .from("orders")
        .select("*, customers(*), order_items(*, products(name))")
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

    return {
      order: orderRes.data,
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

    const { data: order, error: orderError } = await context.supabase
      .from("orders")
      .insert({
        customer_id: data.customer_id,
        seller_id: context.userId,
        notes: data.notes || null,
        status: "novo",
        total,
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
      note: "Pedido criado",
    });

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
      .select("status")
      .eq("id", data.id)
      .single();
    if (readError) throw new Error(readError.message);

    const { data: order, error } = await context.supabase
      .from("orders")
      .update({ status: data.status })
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

    const { recordEvent } = await import("@/lib/events.server");
    const done = ["entregue", "faturado", "finalizado", "concluido"];
    await recordEvent(context.supabase, {
      eventType: done.includes(data.status) ? "venda_concluida" : "pedido_mudou_status",
      entityType: "order",
      entityId: data.id,
      payload: { from_status: current.status, to_status: data.status, total: order.total },
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
