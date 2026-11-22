import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/supabase-auth.middleware";
import { z } from "zod";
import { buildInstallments } from "@/lib/payments";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

export const paymentPlanSchema = z.object({
  installments: z.coerce.number().int().min(1).max(24).default(1),
  first_due_date: isoDate.optional().or(z.literal("")),
  first_paid: z.boolean().default(true),
});

const missingTable = (msg?: string) =>
  !!msg && /order_payments|does not exist|schema cache/i.test(msg);

/** Cria as parcelas da venda. Sem a tabela (migration pendente), não faz nada. */
export async function insertOrderPayments(
  supabase: any,
  orderId: string,
  total: number,
  method: string | null | undefined,
  plan: z.infer<typeof paymentPlanSchema>,
  userId: string,
) {
  const rows = buildInstallments({
    total,
    installments: plan.installments,
    firstDate: plan.first_due_date || new Date().toISOString().slice(0, 10),
    firstPaid: plan.first_paid,
    method,
  }).map((r) => ({ ...r, order_id: orderId, created_by: userId }));
  const { error } = await supabase.from("order_payments").insert(rows);
  if (error && !missingTable(error.message)) throw new Error(error.message);
  return { ok: !error };
}

export const listOrderPayments = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: { orderId: string }) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("order_payments")
      .select("*")
      .eq("order_id", data.orderId)
      .order("number");
    if (error) {
      if (missingTable(error.message)) return { payments: [], migrationPending: true };
      throw new Error(error.message);
    }
    return { payments: rows ?? [], migrationPending: false };
  });

export const setOrderPaymentPaid = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), paid: z.boolean(), paid_at: isoDate.optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("order_payments")
      .update({
        status: data.paid ? "Pago" : "Pendente",
        paid_at: data.paid ? data.paid_at || new Date().toISOString().slice(0, 10) : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateOrderPayment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        due_date: isoDate,
        amount: z.coerce.number().min(0),
        method: z.string().max(60).optional().or(z.literal("")),
        notes: z.string().max(500).optional().or(z.literal("")),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...r } = data;
    const { error } = await context.supabase
      .from("order_payments")
      .update({ ...r, method: r.method || null, notes: r.notes || null })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Refaz as parcelas da venda (ex.: mudou de à vista para 3x). */
export const resetOrderPayments = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    paymentPlanSchema
      .extend({
        orderId: z.string().uuid(),
        method: z.string().max(60).optional().or(z.literal("")),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: order, error } = await sb
      .from("orders")
      .select("total")
      .eq("id", data.orderId)
      .single();
    if (error) throw new Error(error.message);
    const { error: delError } = await sb
      .from("order_payments")
      .delete()
      .eq("order_id", data.orderId);
    if (delError) throw new Error(delError.message);
    await sb
      .from("orders")
      .update({ payment_method: data.method || null })
      .eq("id", data.orderId);
    await insertOrderPayments(
      sb,
      data.orderId,
      Number(order.total ?? 0),
      data.method,
      data,
      context.userId,
    );
    return { ok: true };
  });
