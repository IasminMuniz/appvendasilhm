import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/supabase-auth.middleware";
import { z } from "zod";

export const PURCHASE_STATUSES = ["Pedido", "Recebido", "Cancelado"] as const;

const purchaseItemSchema = z.object({
  product_id: z.string().uuid().optional().nullable().or(z.literal("")),
  description: z.string().trim().min(1, "Descreva o item").max(200),
  quantity: z.coerce.number().int().min(1, "Quantidade mínima é 1"),
  amount: z.coerce.number().min(0),
});

const purchaseSchema = z.object({
  purchase_date: z.string().min(8),
  supplier: z.string().max(80).optional().or(z.literal("")),
  description: z.string().max(300).optional().or(z.literal("")),
  status: z.enum(PURCHASE_STATUSES).default("Pedido"),
  payment_method: z.string().max(60).optional().or(z.literal("")),
  freight: z.coerce.number().min(0).default(0),
  notes: z.string().max(1000).optional().or(z.literal("")),
  items: z.array(purchaseItemSchema).min(1, "Adicione pelo menos um item"),
});

type PurchaseItemRow = { product_id: string | null; quantity: number; amount: number };

/** Soma (sign 1) ou devolve (sign -1) ao estoque os itens com produto; ao somar, atualiza o custo. */
async function applyPurchaseStock(supabase: any, items: PurchaseItemRow[], freight: number, sign: 1 | -1) {
  const itemsTotal = items.reduce((s, i) => s + Number(i.amount), 0);
  for (const it of items) {
    if (!it.product_id || it.quantity <= 0) continue;
    const { data: prod } = await supabase.from("products").select("stock").eq("id", it.product_id).maybeSingle();
    if (!prod) continue;
    const patch: Record<string, number> = { stock: Math.max(0, Number(prod.stock ?? 0) + sign * it.quantity) };
    if (sign === 1) {
      // Custo unitário = valor pago no item + parte proporcional do frete, dividido pela quantidade.
      const freightShare = itemsTotal > 0 ? (Number(it.amount) / itemsTotal) * freight : 0;
      patch.cost = Math.round(((Number(it.amount) + freightShare) / it.quantity) * 100) / 100;
    }
    await supabase.from("products").update(patch).eq("id", it.product_id);
  }
}

const idSchema = z.object({ id: z.string().uuid() });

/** Compras com itens. Se a migração ainda não foi aplicada, devolve as compras sem itens e avisa. */
export const listPurchases = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const full = await context.supabase
      .from("purchases")
      .select("*, purchase_items(*, products(name, sku))")
      .order("purchase_date", { ascending: false });
    if (!full.error) return { purchases: full.data ?? [], migrationPending: false };
    const basic = await context.supabase.from("purchases").select("*").order("purchase_date", { ascending: false });
    if (basic.error) throw new Error(basic.error.message);
    return {
      purchases: (basic.data ?? []).map((p) => ({ ...p, purchase_items: [] as never[] })),
      migrationPending: true,
    };
  });

export const savePurchase = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => purchaseSchema.extend({ id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { id, items, ...r } = data;
    const cleanItems = items.map((i) => ({ ...i, product_id: i.product_id || null }));
    const amount = Math.round((cleanItems.reduce((s, i) => s + i.amount, 0) + r.freight) * 100) / 100;
    const description = r.description || cleanItems.map((i) => `${i.quantity}× ${i.description}`).join(", ").slice(0, 300);
    const row = {
      purchase_date: r.purchase_date,
      supplier: r.supplier || null,
      description,
      status: r.status,
      payment_method: r.payment_method || null,
      freight: r.freight,
      notes: r.notes || null,
      amount,
    };

    let purchaseId = id;
    if (id) {
      const { data: current, error: readError } = await sb
        .from("purchases")
        .select("stock_added, freight, purchase_items(product_id, quantity, amount)")
        .eq("id", id)
        .single();
      if (readError) throw new Error(readError.message);
      if (current.stock_added) await applyPurchaseStock(sb, current.purchase_items ?? [], Number(current.freight ?? 0), -1);
      const { error } = await sb.from("purchases").update({ ...row, stock_added: false }).eq("id", id);
      if (error) throw new Error(error.message);
      const { error: delError } = await sb.from("purchase_items").delete().eq("purchase_id", id);
      if (delError) throw new Error(delError.message);
    } else {
      const { data: inserted, error } = await sb
        .from("purchases")
        .insert({ ...row, created_by: context.userId })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      purchaseId = inserted.id;
    }

    const { error: itemsError } = await sb
      .from("purchase_items")
      .insert(cleanItems.map((i) => ({ ...i, purchase_id: purchaseId! })));
    if (itemsError) throw new Error(itemsError.message);

    if (r.status === "Recebido") {
      await applyPurchaseStock(sb, cleanItems, r.freight, 1);
      await sb.from("purchases").update({ stock_added: true }).eq("id", purchaseId!);
    }
    return { ok: true };
  });

export const deletePurchase = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: current } = await context.supabase
      .from("purchases")
      .select("stock_added, freight, purchase_items(product_id, quantity, amount)")
      .eq("id", data.id)
      .maybeSingle();
    if (current?.stock_added) {
      await applyPurchaseStock(context.supabase, current.purchase_items ?? [], Number(current.freight ?? 0), -1);
    }
    const { error } = await context.supabase.from("purchases").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const EXPENSE_STATUSES = ["Pendente", "Pago"] as const;

const expenseSchema = z.object({
  expense_date: z.string().min(8),
  description: z.string().min(1, "Descrição é obrigatória").max(300),
  category: z.string().max(80).optional().or(z.literal("")),
  amount: z.coerce.number().min(0),
  is_fixed: z.boolean().default(false),
  status: z.enum(EXPENSE_STATUSES).default("Pendente"),
  paid_at: z.string().optional().or(z.literal("")),
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
    const { id, status, paid_at, ...r } = data;
    const base = { ...r, category: r.category || null };
    const paid = status === "Pago" ? paid_at || new Date().toISOString().slice(0, 10) : null;
    const write = (row: typeof base & { status?: string; paid_at?: string | null }) =>
      id
        ? context.supabase.from("expenses").update(row).eq("id", id)
        : context.supabase.from("expenses").insert({ ...row, created_by: context.userId });
    let { error } = await write({ ...base, status, paid_at: paid });
    // Banco ainda sem as colunas de pagamento: salva sem elas.
    if (error && /status|paid_at|column|schema cache/i.test(error.message)) ({ error } = await write(base));
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
      sb.from("purchases").select("*").gte("purchase_date", start).lt("purchase_date", end),
      sb.from("purchases").select("*"),
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
    const sum = (rows: { amount: number; status?: string | null }[] | null) =>
      (rows ?? []).filter((r) => r.status !== "Cancelado").reduce((s, r) => s + Number(r.amount ?? 0), 0);
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
