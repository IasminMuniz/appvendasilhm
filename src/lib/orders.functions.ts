import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/supabase-auth.middleware";
import { z } from "zod";

const orderStatusSchema = z.enum(["pendente", "em_andamento", "concluido", "cancelado"]);

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
      .select("*, customers(name), order_items(*, products(name))")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getOrder = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: order, error } = await context.supabase
      .from("orders")
      .select("*, customers(*), order_items(*, products(name))")
      .eq("id", data.id)
      .single();

    if (error) throw new Error(error.message);
    return order;
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

    return order;
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string; status: string }) =>
    z.object({ id: z.string().uuid(), status: orderStatusSchema }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { data: order, error } = await context.supabase
      .from("orders")
      .update({ status: data.status })
      .eq("id", data.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return order;
  });
