import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/supabase-auth.middleware";
import { z } from "zod";
import { buildSku, calcMargin, nextModelNumber } from "@/lib/clothing";
import { fetchSuppliers } from "@/lib/store.functions";
import { recountStock } from "@/lib/stock.server";
import { recalcOrders, recalcSalesForProducts, reservePctOf } from "@/lib/order-recalc";
import { effectivePackaging, profitOf } from "@/lib/sales";
import { splitSales } from "@/lib/cash";
import { fetchCashPlan } from "@/lib/store.functions";

export const PURCHASE_STATUSES = ["Pedido", "Recebido", "Cancelado"] as const;

const newProductSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao produto novo").max(200),
  style: z.string().max(80).optional().or(z.literal("")),
  color: z.string().max(80).optional().or(z.literal("")),
  pattern: z.string().max(80).optional().or(z.literal("")),
  size: z.string().max(20).optional().or(z.literal("")),
  price: z.coerce.number().min(0).default(0),
});

const purchaseItemSchema = z.object({
  product_id: z.string().uuid().optional().nullable().or(z.literal("")),
  description: z.string().trim().min(1, "Descreva o item").max(200),
  quantity: z.coerce.number().int().min(1, "Quantidade mínima é 1"),
  amount: z.coerce.number().min(0),
  /** Produto que ainda não existe: é cadastrado a partir da compra, ligado ao fornecedor dela. */
  new_product: newProductSchema.optional().nullable(),
});

/**
 * Cadastra (ou reaproveita) o produto de um item novo da compra.
 * O produto pertence ao fornecedor: mesmo nome em outro fornecedor vira outro produto/SKU.
 */
async function ensureProductFromPurchase(
  supabase: any,
  supplier: string,
  np: z.infer<typeof newProductSchema>,
  unitCost: number,
): Promise<string> {
  const { data: existing } = await supabase
    .from("products")
    .select("id")
    .eq("supplier", supplier)
    .eq("name", np.name)
    .eq("size", np.size || "")
    .maybeSingle();
  if (existing?.id) return existing.id;

  const suppliers = (await fetchSuppliers(supabase)).map((x) => ({ value: x.name, code: x.code }));
  let modelNumber: number | null = null;
  if (np.style && np.color && np.pattern) {
    const { data: rows } = await supabase
      .from("products")
      .select("model_number")
      .eq("supplier", supplier)
      .eq("style", np.style)
      .eq("color", np.color)
      .eq("pattern", np.pattern);
    modelNumber = nextModelNumber(
      (rows ?? []).map((r: { model_number: number | null }) => r.model_number),
    );
  }
  const sku = buildSku(
    {
      supplier,
      style: np.style,
      color: np.color,
      pattern: np.pattern,
      size: np.size,
      model_number: modelNumber,
    },
    suppliers,
  );
  const cost = Math.round(unitCost * 100) / 100;
  const { data: created, error } = await supabase
    .from("products")
    .insert({
      name: np.name,
      supplier,
      style: np.style || null,
      color: np.color || null,
      pattern: np.pattern || null,
      size: np.size || null,
      model_number: modelNumber,
      sku,
      cost,
      price: np.price,
      margin_percent: calcMargin(np.price, cost),
      stock: 0,
      active: true,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Não consegui cadastrar "${np.name}": ${error.message}`);
  return created.id;
}

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
async function applyPurchaseStock(
  supabase: any,
  items: PurchaseItemRow[],
  freight: number,
  sign: 1 | -1,
) {
  const itemsTotal = items.reduce((s, i) => s + Number(i.amount), 0);
  for (const it of items) {
    if (!it.product_id || it.quantity <= 0) continue;
    const { data: prod } = await supabase
      .from("products")
      .select("stock")
      .eq("id", it.product_id)
      .maybeSingle();
    if (!prod) continue;
    const patch: Record<string, number> = {
      stock: Math.max(0, Number(prod.stock ?? 0) + sign * it.quantity),
    };
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
    const basic = await context.supabase
      .from("purchases")
      .select("*")
      .order("purchase_date", { ascending: false });
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
    // Itens com produto novo: cadastra o produto no fornecedor da compra (gera o SKU).
    if (items.some((i) => i.new_product && !i.product_id) && !r.supplier)
      throw new Error("Escolha o fornecedor da compra para cadastrar produtos novos.");
    for (const i of items) {
      if (i.new_product && !i.product_id) {
        i.product_id = await ensureProductFromPurchase(
          sb,
          r.supplier!,
          i.new_product,
          i.amount / Math.max(1, i.quantity),
        );
        i.description = i.new_product.name;
      }
    }
    const cleanItems = items.map(({ new_product: _np, ...i }) => ({
      ...i,
      product_id: i.product_id || null,
    }));
    const amount =
      Math.round((cleanItems.reduce((s, i) => s + i.amount, 0) + r.freight) * 100) / 100;
    const description =
      r.description ||
      cleanItems
        .map((i) => `${i.quantity}× ${i.description}`)
        .join(", ")
        .slice(0, 300);
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
      if (current.stock_added)
        await applyPurchaseStock(
          sb,
          current.purchase_items ?? [],
          Number(current.freight ?? 0),
          -1,
        );
      const { error } = await sb
        .from("purchases")
        .update({ ...row, stock_added: false })
        .eq("id", id);
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
      await recalcSalesForProducts(
        sb,
        cleanItems.map((i) => i.product_id ?? ""),
      );
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
      await applyPurchaseStock(
        context.supabase,
        current.purchase_items ?? [],
        Number(current.freight ?? 0),
        -1,
      );
    }
    const { error } = await context.supabase.from("purchases").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const EXPENSE_STATUSES = ["Pendente", "Pago"] as const;

export const PAYMENT_METHODS = [
  "Pix",
  "Cartão de crédito pessoal",
  "Cartão de débito",
  "Boleto",
  "Dinheiro",
  "Outro",
] as const;

const expenseSchema = z.object({
  /** Vencimento: decide o mês da despesa e quando ela fica vencida. */
  expense_date: z.string().min(8),
  /** Data da compra (opcional). Ex.: compra no cartão em 22/11, fatura vence 10/12. */
  purchase_date: z.string().optional().or(z.literal("")),
  description: z.string().min(1, "Descrição é obrigatória").max(300),
  category: z.string().max(80).optional().or(z.literal("")),
  payment_method: z.string().max(60).optional().or(z.literal("")),
  amount: z.coerce.number().min(0),
  is_fixed: z.boolean().default(false),
  status: z.enum(EXPENSE_STATUSES).default("Pendente"),
  paid_at: z.string().optional().or(z.literal("")),
  /** Só na criação de despesa fixa: quantos meses lançar (1 = só este). */
  repeat_months: z.coerce.number().int().min(1).max(60).default(1),
});

/** Mesma data N meses depois, ajustando o dia para o fim do mês quando preciso (ex.: 31/01 → 28/02). */
export function addMonths(isoDate: string, n: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

const isMissingColumn = (msg: string) =>
  /status|paid_at|series_id|purchase_date|payment_method|column|schema cache/i.test(msg);

export const listExpenses = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveExpense = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => expenseSchema.extend({ id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { id, status, paid_at, repeat_months, purchase_date, ...r } = data;
    const base = { ...r, category: r.category || null, payment_method: r.payment_method || null };
    const bought = purchase_date || r.expense_date;
    const paid = status === "Pago" ? paid_at || new Date().toISOString().slice(0, 10) : null;

    if (id) {
      let { error } = await sb
        .from("expenses")
        .update({ ...base, status, paid_at: paid, purchase_date: bought })
        .eq("id", id);
      // Banco ainda sem as colunas de pagamento: salva sem elas.
      if (error && isMissingColumn(error.message))
        ({ error } = await sb
          .from("expenses")
          .update({ ...base, payment_method: undefined })
          .eq("id", id));
      if (error) throw new Error(error.message);
      return { ok: true, created: 0 };
    }

    // Despesa fixa: lança este mês e os próximos (os futuros ficam Pendentes).
    const months = r.is_fixed ? repeat_months : 1;
    const seriesId = months > 1 ? crypto.randomUUID() : null;
    const rows = Array.from({ length: months }, (_, i) => ({
      ...base,
      expense_date: addMonths(r.expense_date, i),
      purchase_date: addMonths(bought, i),
      status: i === 0 ? status : "Pendente",
      paid_at: i === 0 ? paid : null,
      series_id: seriesId,
      created_by: context.userId,
    }));
    let { error } = await sb.from("expenses").insert(rows);
    if (error && isMissingColumn(error.message)) {
      ({ error } = await sb
        .from("expenses")
        .insert(
          rows.map(
            ({
              status: _s,
              paid_at: _p,
              series_id: _id,
              purchase_date: _b,
              payment_method: _m,
              ...rest
            }) => rest,
          ),
        ));
    }
    if (error) throw new Error(error.message);
    return { ok: true, created: rows.length };
  });

/** Exclui uma despesa; com scope "future", também as próximas pendentes da mesma despesa fixa. */
export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    idSchema.extend({ scope: z.enum(["one", "future"]).default("one") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    if (data.scope === "future") {
      const { data: cur, error: readError } = await sb
        .from("expenses")
        .select("*")
        .eq("id", data.id)
        .single();
      if (readError) throw new Error(readError.message);
      const seriesId = (cur as { series_id?: string | null }).series_id;
      let q = sb
        .from("expenses")
        .delete()
        .gt("expense_date", cur.expense_date)
        .eq("status", "Pendente");
      q = seriesId
        ? q.eq("series_id", seriesId)
        : q.eq("description", cur.description).eq("is_fixed", true);
      const { error: futureError } = await q;
      if (futureError && !isMissingColumn(futureError.message))
        throw new Error(futureError.message);
    }
    const { error } = await sb.from("expenses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Aportes: dinheiro seu colocado na loja (o inicial e os que vierem depois). */
const contributionSchema = z.object({
  contribution_date: z.string().min(8),
  amount: z.coerce.number().positive("Informe o valor do aporte"),
  description: z.string().max(200).optional().or(z.literal("")),
});

export const saveContribution = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => contributionSchema.extend({ id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...r } = data;
    const row = { ...r, description: r.description || null };
    const { error } = id
      ? await context.supabase.from("capital_contributions").update(row).eq("id", id)
      : await context.supabase
          .from("capital_contributions")
          .insert({ ...row, created_by: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteContribution = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("capital_contributions")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Indicadores do mês (YYYY-MM) para o dashboard da loja. */
export const getStoreDashboard = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: { month: string }) =>
    z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const [y, m] = data.month.split("-").map(Number) as [number, number];
    const start = `${data.month}-01`;
    const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    const sb = context.supabase;
    await recountStock(sb);
    const [ordersRes, productsRes, purchMonth, purchAll, expRes] = await Promise.all([
      sb
        .from("orders")
        .select("*, order_items(quantity, unit_price, products(*))")
        .in("status", ["pago", "entregue"])
        .gte("created_at", start)
        .lt("created_at", end),
      sb.from("products").select("*"),
      sb.from("purchases").select("*").gte("purchase_date", start).lt("purchase_date", end),
      sb.from("purchases").select("*"),
      sb
        .from("expenses")
        .select("amount, is_fixed")
        .gte("expense_date", start)
        .lt("expense_date", end),
    ]);
    for (const r of [ordersRes, productsRes, purchMonth, purchAll, expRes])
      if (r.error) throw new Error(r.error.message);

    // Trocas e devoluções do mês (sem a migração 0019, vem com erro e fica vazio).
    const retRes = await sb
      .from("orders")
      .select("return_type, return_reason, order_items(quantity, products(name, size))")
      .not("return_type", "is", null)
      .gte("returned_at", start)
      .lt("returned_at", end);
    const returnsRows = retRes.error ? [] : (retRes.data ?? []);
    const reasonCount: Record<string, number> = {};
    const pieceCount: Record<string, number> = {};
    for (const r of returnsRows) {
      const reason = r.return_reason || "Sem motivo";
      reasonCount[reason] = (reasonCount[reason] ?? 0) + 1;
      for (const i of r.order_items ?? []) {
        const pr = i.products as { name?: string; size?: string | null } | null;
        const key = `${pr?.name ?? "Peça"}${pr?.size ? ` (${pr.size})` : ""}`;
        pieceCount[key] = (pieceCount[key] ?? 0) + Number(i.quantity ?? 0);
      }
    }
    const top = (m: Record<string, number>) =>
      Object.entries(m)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([label, count]) => ({ label, count }));

    const orders = ordersRes.data ?? [];
    // Lucro calculado na hora com o custo atual dos produtos e o % para outros fins.
    const reservePct = await reservePctOf(sb);
    const byChannel: Record<
      string,
      { channel: string; revenue: number; profit: number; count: number }
    > = {};
    let revenue = 0,
      profit = 0,
      pieces = 0;
    // Novos x seminovos: receita e lucro da venda divididos pelo valor de cada peça.
    const byCondition = {
      novo: { revenue: 0, profit: 0, pieces: 0 },
      seminovo: { revenue: 0, profit: 0, pieces: 0 },
    };
    for (const o of orders) {
      const t = Number(o.total ?? 0),
        p = profitOf({
          total: t,
          channelFee: Number(o.channel_fee ?? 0),
          otherCosts: Number(o.other_costs ?? 0),
          productCost: (o.order_items ?? []).reduce(
            (s, i) => s + Number(i.quantity ?? 0) * Number(i.products?.cost ?? 0),
            0,
          ),
          packaging: effectivePackaging(o),
          reservePct,
        }).profit;
      revenue += t;
      profit += p;
      const its = o.order_items ?? [];
      const itemsTotal = its.reduce(
        (s, i) => s + Number(i.quantity ?? 0) * Number(i.unit_price ?? 0),
        0,
      );
      for (const i of its) {
        const share =
          itemsTotal > 0
            ? (Number(i.quantity ?? 0) * Number(i.unit_price ?? 0)) / itemsTotal
            : 1 / its.length;
        const c = (i.products as { condition?: string } | null)?.condition === "seminovo"
          ? "seminovo"
          : "novo";
        byCondition[c].revenue += t * share;
        byCondition[c].profit += p * share;
        byCondition[c].pieces += Number(i.quantity ?? 0);
      }
      pieces += (o.order_items ?? []).reduce((s, i) => s + Number(i.quantity ?? 0), 0);
      const ch = o.channel || "Sem canal";
      byChannel[ch] ??= { channel: ch, revenue: 0, profit: 0, count: 0 };
      byChannel[ch].revenue += t;
      byChannel[ch].profit += p;
      byChannel[ch].count += 1;
    }
    const sum = (rows: { amount: number; status?: string | null }[] | null) =>
      (rows ?? [])
        .filter((r) => r.status !== "Cancelado")
        .reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const expenses = expRes.data ?? [];
    return {
      revenue,
      profit,
      pieces,
      salesCount: orders.length,
      stock: (productsRes.data ?? [])
        .filter((p) => p.active)
        .reduce((s, p) => s + Number(p.stock ?? 0), 0),
      stockValue:
        Math.round(
          (productsRes.data ?? [])
            .filter((p) => p.active)
            .reduce((s, p) => s + Number(p.stock ?? 0) * Number(p.cost ?? 0), 0) * 100,
        ) / 100,
      purchasesMonth: sum(purchMonth.data),
      purchasesTotal: sum(purchAll.data),
      expensesMonth: sum(expenses),
      fixedExpenses: sum(expenses.filter((e) => e.is_fixed)),
      returns: {
        trocas: returnsRows.filter((r) => r.return_type === "troca").length,
        devolucoes: returnsRows.filter((r) => r.return_type === "devolucao").length,
        reasons: top(reasonCount),
        pieces: top(pieceCount),
      },
      seminovoProducts: (productsRes.data ?? []).filter(
        (p) => (p as { condition?: string }).condition === "seminovo",
      ).length,
      conditions: (["novo", "seminovo"] as const).map((k) => ({
        condition: k,
        revenue: Math.round(byCondition[k].revenue * 100) / 100,
        profit: Math.round(byCondition[k].profit * 100) / 100,
        pieces: byCondition[k].pieces,
      })),
      channels: Object.values(byChannel).map((c) => ({
        ...c,
        revenue: Math.round(c.revenue * 100) / 100,
        profit: Math.round(c.profit * 100) / 100,
      })),
    };
  });

/**
 * Caixa da loja: saldo, entradas e saídas do período e a divisão do dinheiro das vendas
 * (reposição, reserva, outros fins, crescimento e seu lucro).
 */
export const getCashFlow = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: { month: string }) =>
    z.object({ month: z.union([z.literal("all"), z.string().regex(/^\d{4}-\d{2}$/)]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    await recountStock(sb);
    const [ordersRes, purchasesRes, expensesRes, productsRes, plan, paymentsRes, contribRes] =
      await Promise.all([
        sb.from("orders").select("*, customers(name)").neq("status", "cancelado"),
        sb.from("purchases").select("*"),
        sb.from("expenses").select("*"),
        sb
          .from("products")
          .select("id, name, sku, stock, active")
          .eq("active", true)
          .order("stock"),
        fetchCashPlan(sb),
        // Parcelas das clientes (se a migration ainda não foi aplicada, vem com erro e é ignorado).
        sb.from("order_payments").select("order_id, number, due_date, amount, status, paid_at"),
        // Aportes (se a migration ainda não foi aplicada, vem com erro e é ignorado).
        sb
          .from("capital_contributions")
          .select("*")
          .order("contribution_date", { ascending: false }),
      ]);
    for (const r of [ordersRes, purchasesRes, expensesRes, productsRes])
      if (r.error) throw new Error(r.error.message);

    const inPeriod = (d: string | null | undefined) =>
      !!d && (data.month === "all" || d.startsWith(data.month));
    const today = new Date().toISOString().slice(0, 10);
    const in30 = addMonths(today, 1);
    const n = (v: unknown) => Number(v ?? 0) || 0;

    const allOrders = ordersRes.data ?? [];
    const payments = paymentsRes.error ? [] : (paymentsRes.data ?? []);
    const paysByOrder = new Map<string, typeof payments>();
    for (const p of payments)
      paysByOrder.set(p.order_id, [...(paysByOrder.get(p.order_id) ?? []), p]);
    const sales = allOrders
      .filter((o) => o.status === "pago" || o.status === "entregue")
      .map((o) => ({
        total: n(o.total),
        channel_fee: n(o.channel_fee),
        other_costs: n(o.other_costs),
        product_cost: n(o.product_cost),
        packaging_cost: effectivePackaging(o),
        date: String(o.created_at).slice(0, 10),
      }));
    const purchases = (purchasesRes.data ?? []).filter((p) => p.status !== "Cancelado");
    const expenses = (expensesRes.data ?? []) as Array<{
      amount: number;
      status?: string | null;
      paid_at?: string | null;
      expense_date: string;
      description: string;
    }>;
    // Sem a coluna de situação (banco antigo), toda despesa conta como paga.
    const isPaid = (e: { status?: string | null }) => e.status === undefined || e.status === "Pago";
    const paidExpenses = expenses.filter(isPaid);
    const expenseDate = (e: { paid_at?: string | null; expense_date: string }) =>
      e.paid_at || e.expense_date;

    const sumBy = <T>(rows: T[], f: (r: T) => number) =>
      Math.round(rows.reduce((t, r) => t + f(r), 0) * 100) / 100;

    // Entradas de dinheiro: com parcelas lançadas, conta só o que a cliente já pagou (na data do recebimento);
    // sem parcelas, conta a venda paga/entregue inteira na data da venda. A taxa do canal é descontada.
    const inflows: { date: string; amount: number }[] = [];
    const toReceive: {
      customer: string;
      orderId: string;
      number: number;
      count: number;
      date: string;
      amount: number;
      overdue: boolean;
    }[] = [];
    for (const o of allOrders) {
      const total = n(o.total);
      const net = total > 0 ? (total - n(o.channel_fee)) / total : 1;
      const pays = paysByOrder.get(o.id);
      if (pays?.length) {
        for (const p of pays) {
          if (p.status === "Pago")
            inflows.push({ date: p.paid_at || p.due_date, amount: n(p.amount) * net });
          else
            toReceive.push({
              customer: (o.customers as { name?: string } | null)?.name ?? "Cliente",
              orderId: o.id,
              number: p.number,
              count: pays.length,
              date: p.due_date,
              amount: n(p.amount),
              overdue: p.due_date < today,
            });
        }
      } else if (o.status === "pago" || o.status === "entregue") {
        inflows.push({ date: String(o.created_at).slice(0, 10), amount: total - n(o.channel_fee) });
      }
    }
    toReceive.sort((a, b) => a.date.localeCompare(b.date));

    // Desde o início: o que entrou das vendas e tudo que saiu.
    const totalIn = sumBy(inflows, (f) => f.amount);
    const totalOut =
      sumBy(purchases, (p) => n(p.amount)) +
      sumBy(paidExpenses, (e) => n(e.amount)) +
      sumBy(sales, (s) => s.other_costs);
    // Resultado acumulado: o que entrou das vendas − tudo que você gastou (sem precisar de aporte).
    const balance = Math.round((totalIn - totalOut) * 100) / 100;

    // Período escolhido
    const pSales = sales.filter((s) => inPeriod(s.date));
    const pPurchases = purchases.filter((p) => inPeriod(p.purchase_date));
    const pExpenses = paidExpenses.filter((e) => inPeriod(expenseDate(e)));
    const period = {
      salesCount: pSales.length,
      received: sumBy(
        inflows.filter((f) => inPeriod(f.date)),
        (f) => f.amount,
      ),
      purchases: sumBy(pPurchases, (p) => n(p.amount)),
      expenses: sumBy(pExpenses, (e) => n(e.amount)),
      saleCosts: sumBy(pSales, (s) => s.other_costs),
    };
    const periodResult =
      Math.round((period.received - period.purchases - period.expenses - period.saleCosts) * 100) /
      100;

    // Potes: divisão do dinheiro das vendas do período e acumulado desde o início
    const split = splitSales(pSales, plan);
    const splitAll = splitSales(sales, plan);

    // Dinheiro para nova compra: reposição + crescimento acumulados, menos compras feitas depois da 1ª venda.
    const firstSale = sales.map((s) => s.date).sort()[0];
    const rebuyPurchases = firstSale
      ? sumBy(
          purchases.filter((p) => p.purchase_date >= firstSale),
          (p) => n(p.amount),
        )
      : 0;
    const availableToBuy =
      Math.round((splitAll.restock + splitAll.packaging + splitAll.growth - rebuyPurchases) * 100) /
      100;

    const upcoming = expenses
      .filter((e) => !isPaid(e) && e.expense_date <= in30)
      .sort((a, b) => a.expense_date.localeCompare(b.expense_date));

    const contributions = contribRes.error ? [] : (contribRes.data ?? []);
    const contributed = sumBy(contributions, (c) => n(c.amount));
    // Dinheiro da loja agora: aportes + o que entrou das vendas − tudo que já saiu.
    const cashOnHand = Math.round((contributed + totalIn - totalOut) * 100) / 100;

    return {
      plan,
      balance,
      contributions: contributions.map((c) => ({
        id: c.id,
        date: c.contribution_date,
        amount: n(c.amount),
        description: c.description ?? "",
      })),
      contributed,
      cashOnHand,
      totalIn,
      totalOut,
      period,
      periodResult,
      split,
      splitAll,
      availableToBuy,
      rebuyPurchases,
      upcoming: upcoming.map((e) => ({
        description: e.description,
        date: e.expense_date,
        amount: n(e.amount),
        overdue: e.expense_date < today,
      })),
      upcomingTotal: sumBy(upcoming, (e) => n(e.amount)),
      toReceive,
      toReceiveTotal: sumBy(toReceive, (r) => r.amount),
      lowStock: (productsRes.data ?? [])
        .filter((p) => n(p.stock) <= 1)
        .map((p) => ({ id: p.id, name: p.name, sku: p.sku, stock: n(p.stock) })),
      piecesInStock: sumBy(productsRes.data ?? [], (p) => n(p.stock)),
    };
  });
