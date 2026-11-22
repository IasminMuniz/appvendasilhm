import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/supabase-auth.middleware";
import { z } from "zod";
import { adjustStock } from "@/lib/orders.functions";

const idsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "Selecione ao menos um registro").max(500),
});

type Ctx = { supabase: any; userId: string };

async function assertAdmin(context: Ctx) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Acesso negado: apenas administradores podem executar esta ação.");
}

/** Remove em lote e informa quantos registros o RLS realmente permitiu excluir. */
async function deleteMany(context: Ctx, table: string, ids: string[]) {
  const { data, error } = await context.supabase.from(table).delete().in("id", ids).select("id");
  if (error) {
    if (error.code === "23503")
      throw new Error(
        "Não foi possível excluir: existem registros vinculados (pedidos, orçamentos ou itens).",
      );
    throw new Error(error.message);
  }
  const deleted = (data ?? []).length;
  return { deleted, skipped: ids.length - deleted };
}

export const bulkDeleteLeads = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { ids: string[] }) => idsSchema.parse(data))
  .handler(async ({ data, context }) => deleteMany(context, "leads", data.ids));

export const bulkDeleteCustomers = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { ids: string[] }) => idsSchema.parse(data))
  .handler(async ({ data, context }) => deleteMany(context, "customers", data.ids));

export const bulkDeleteOrders = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { ids: string[] }) => idsSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Excluir vendas devolve as peças ao estoque.
    const { data: rows } = await context.supabase
      .from("orders")
      .select("id, stock_deducted")
      .in("id", data.ids);
    for (const o of rows ?? []) if (o.stock_deducted) await adjustStock(context.supabase, o.id, 1);
    return deleteMany(context, "orders", data.ids);
  });

export const bulkDeleteQuotes = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { ids: string[] }) => idsSchema.parse(data))
  .handler(async ({ data, context }) => deleteMany(context, "quotes", data.ids));

export const bulkDeleteProducts = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { ids: string[] }) => idsSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    await context.supabase.from("product_images").delete().in("product_id", data.ids);
    await context.supabase.from("product_documents").delete().in("product_id", data.ids);
    return deleteMany(context, "products", data.ids);
  });
