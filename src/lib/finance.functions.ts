import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/supabase-auth.middleware";
import { z } from "zod";

const purchaseSchema = z.object({
  purchase_date: z.string().min(8),
  supplier: z.string().max(80).optional().or(z.literal("")),
  description: z.string().min(1, "Descrição é obrigatória").max(300),
  amount: z.coerce.number().min(0),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

const expenseSchema = z.object({
  expense_date: z.string().min(8),
  description: z.string().min(1, "Descrição é obrigatória").max(300),
  category: z.string().max(80).optional().or(z.literal("")),
  amount: z.coerce.number().min(0),
  is_fixed: z.boolean().default(false),
});

const idSchema = z.object({ id: z.string().uuid() });

export const listPurchases = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("purchases").select("*").order("purchase_date", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const savePurchase = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => purchaseSchema.extend({ id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...r } = data;
    const row = { ...r, supplier: r.supplier || null, notes: r.notes || null };
    const { error } = id
      ? await context.supabase.from("purchases").update(row).eq("id", id)
      : await context.supabase.from("purchases").insert({ ...row, created_by: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePurchase = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("purchases").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listExpenses = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("expenses").select("*").order("expense_date", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveExpense = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => expenseSchema.extend({ id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...r } = data;
    const row = { ...r, category: r.category || null };
    const { error } = id
      ? await context.supabase.from("expenses").update(row).eq("id", id)
      : await context.supabase.from("expenses").insert({ ...row, created_by: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("expenses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Indicadores do mês (YYYY-MM) para o dashboard da loja. */
export const getStoreDashboard = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: { month: string }) => z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const [y, m] = data.month.split("-").map(Number) as [number, number];
    const start = `${data.month}-01`;
    const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    const sb = context.supabase;
    const [ordersRes, productsRes, purchMonth, purchAll, expRes] = await Promise.all([
      sb.from("orders").select("total, profit, channel, order_items(quantity)").in("status", ["pago", "entregue"]).gte("created_at", start).lt("created_at", end),
      sb.from("products").select("stock, active"),
      sb.from("purchases").select("amount").gte("purchase_date", start).lt("purchase_date", end),
      sb.from("purchases").select("amount"),
      sb.from("expenses").select("amount, is_fixed").gte("expense_date", start).lt("expense_date", end),
    ]);
    for (const r of [ordersRes, productsRes, purchMonth, purchAll, expRes]) if (r.error) throw new Error(r.error.message);

    const orders = ordersRes.data ?? [];
    const byChannel: Record<string, { channel: string; revenue: number; profit: number; count: number }> = {};
    let revenue = 0, profit = 0, pieces = 0;
    for (const o of orders) {
      const t = Number(o.total ?? 0), p = Number(o.profit ?? 0);
      revenue += t; profit += p;
      pieces += (o.order_items ?? []).reduce((s, i) => s + Number(i.quantity ?? 0), 0);
      const ch = o.channel || "Sem canal";
      byChannel[ch] ??= { channel: ch, revenue: 0, profit: 0, count: 0 };
      byChannel[ch].revenue += t; byChannel[ch].profit += p; byChannel[ch].count += 1;
    }
    const sum = (rows: { amount: number }[] | null) => (rows ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const expenses = expRes.data ?? [];
    return {
      revenue, profit, pieces, salesCount: orders.length,
      stock: (productsRes.data ?? []).filter((p) => p.active).reduce((s, p) => s + Number(p.stock ?? 0), 0),
      purchasesMonth: sum(purchMonth.data),
      purchasesTotal: sum(purchAll.data),
      expensesMonth: sum(expenses),
      fixedExpenses: sum(expenses.filter((e) => e.is_fixed)),
      channels: Object.values(byChannel).map((c) => ({ ...c, revenue: Math.round(c.revenue * 100) / 100, profit: Math.round(c.profit * 100) / 100 })),
    };
  });
