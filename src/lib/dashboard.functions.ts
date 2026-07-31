import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/supabase-auth.middleware";
import { z } from "zod";

const CANCELLED = new Set(["cancelado"]);

function monthKey(date: string) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Painel comercial consolidado: vendas, funil, metas e rankings. */
export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const [ordersRes, leadsRes, quotesRes, customersRes, goalsRes, profilesRes, rolesRes] =
      await Promise.all([
        supabase.from("orders").select("*, order_items(*, products(name))"),
        supabase.from("leads").select("*"),
        supabase.from("quotes").select("*"),
        supabase.from("customers").select("id, name, company_name, owner_id, created_at"),
        supabase.from("goals").select("*"),
        supabase.from("profiles").select("id, full_name, email"),
        supabase.from("user_roles").select("role").eq("user_id", context.userId),
      ]);

    const orders = ordersRes.data ?? [];
    const leads = leadsRes.data ?? [];
    const quotes = quotesRes.data ?? [];
    const customers = customersRes.data ?? [];
    const goals = goalsRes.data ?? [];
    const profileMap = Object.fromEntries(
      (profilesRes.data ?? []).map((p) => [p.id, p.full_name || p.email || "Usuário"]),
    );

    const validOrders = orders.filter((o) => !CANCELLED.has(o.status as string));
    const revenue = validOrders.reduce((sum, o) => sum + Number(o.total ?? 0), 0);
    const averageTicket = validOrders.length ? revenue / validOrders.length : 0;

    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Evolução dos últimos 12 meses
    const monthly = new Map<string, number>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthly.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, 0);
    }
    for (const order of validOrders) {
      const key = monthKey(order.created_at);
      if (monthly.has(key)) monthly.set(key, monthly.get(key)! + Number(order.total ?? 0));
    }
    const monthlySeries = [...monthly.entries()].map(([key, total]) => {
      const [year, month] = key.split("-");
      return {
        key,
        label: `${month}/${year!.slice(2)}`,
        total,
      };
    });

    const monthRevenue = monthly.get(currentKey) ?? 0;

    // Ranking por vendedor
    const bySeller = new Map<string, number>();
    for (const order of validOrders) {
      bySeller.set(order.seller_id, (bySeller.get(order.seller_id) ?? 0) + Number(order.total ?? 0));
    }
    const sellerRanking = [...bySeller.entries()]
      .map(([sellerId, total]) => ({ sellerId, name: profileMap[sellerId] ?? "Usuário", total }))
      .sort((a, b) => b.total - a.total);

    // Ranking por produto
    const byProduct = new Map<string, { name: string; quantity: number; total: number }>();
    for (const order of validOrders) {
      for (const item of order.order_items ?? []) {
        const name = item.products?.name ?? "Produto";
        const entry = byProduct.get(name) ?? { name, quantity: 0, total: 0 };
        entry.quantity += Number(item.quantity ?? 0);
        entry.total += Number(item.total ?? 0);
        byProduct.set(name, entry);
      }
    }
    const productRanking = [...byProduct.values()].sort((a, b) => b.total - a.total).slice(0, 10);

    // Ranking por cliente
    const byCustomer = new Map<string, number>();
    for (const order of validOrders) {
      byCustomer.set(
        order.customer_id,
        (byCustomer.get(order.customer_id) ?? 0) + Number(order.total ?? 0),
      );
    }
    const customerMap = Object.fromEntries(
      customers.map((c) => [c.id, c.company_name || c.name]),
    );
    const customerRanking = [...byCustomer.entries()]
      .map(([customerId, total]) => ({
        customerId,
        name: customerMap[customerId] ?? "Cliente",
        total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Funil de leads
    const funnel = new Map<string, { count: number; value: number }>();
    for (const lead of leads) {
      const entry = funnel.get(lead.stage) ?? { count: 0, value: 0 };
      entry.count += 1;
      entry.value += Number(lead.estimated_value ?? 0);
      funnel.set(lead.stage, entry);
    }
    const won = leads.filter((l) => l.stage === "ganho").length;
    const lost = leads.filter((l) => l.stage === "perdido").length;
    const conversionRate = won + lost > 0 ? (won / (won + lost)) * 100 : 0;

    // Orçamentos
    const quoteStats = {
      total: quotes.length,
      pendingApproval: quotes.filter((q) => q.status === "aguardando_aprovacao").length,
      approved: quotes.filter((q) => q.status === "aprovado").length,
      converted: quotes.filter((q) => q.status === "convertido").length,
      openValue: quotes
        .filter((q) => ["rascunho", "aguardando_aprovacao", "aprovado"].includes(q.status))
        .reduce((sum, q) => sum + Number(q.total ?? 0), 0),
      conversionRate: quotes.length
        ? (quotes.filter((q) => q.status === "convertido").length / quotes.length) * 100
        : 0,
    };

    // Metas do período atual
    const today = now.toISOString().slice(0, 10);
    const activeGoals = goals.filter((g) => g.period_start <= today && g.period_end >= today);
    const goalProgress = activeGoals.map((goal) => {
      const achieved = validOrders
        .filter((o) => {
          const date = o.created_at.slice(0, 10);
          const inPeriod = date >= goal.period_start && date <= goal.period_end;
          const matchesUser = goal.user_id ? o.seller_id === goal.user_id : true;
          return inPeriod && matchesUser;
        })
        .reduce((sum, o) => sum + Number(o.total ?? 0), 0);
      return {
        id: goal.id,
        owner: goal.user_id ? (profileMap[goal.user_id] ?? "Usuário") : "Equipe",
        target: Number(goal.target_amount),
        achieved,
        percent: Number(goal.target_amount) > 0 ? (achieved / Number(goal.target_amount)) * 100 : 0,
        periodStart: goal.period_start,
        periodEnd: goal.period_end,
      };
    });

    // Alertas de clientes inativos
    const lastOrderByCustomer = new Map<string, string>();
    for (const order of validOrders) {
      const prev = lastOrderByCustomer.get(order.customer_id);
      if (!prev || order.created_at > prev) lastOrderByCustomer.set(order.customer_id, order.created_at);
    }
    const inactiveCustomers = customers
      .map((c) => {
        const last = lastOrderByCustomer.get(c.id) ?? null;
        const days = last
          ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000)
          : Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000);
        return { id: c.id, name: c.company_name || c.name, days, lastOrder: last };
      })
      .filter((c) => c.days > 60)
      .sort((a, b) => b.days - a.days)
      .slice(0, 10);

    return {
      roles: rolesRes.data?.map((r) => r.role) ?? [],
      totals: {
        revenue,
        monthRevenue,
        orders: validOrders.length,
        averageTicket,
        customers: customers.length,
        leads: leads.length,
        conversionRate,
      },
      monthlySeries,
      sellerRanking,
      productRanking,
      customerRanking,
      funnel: [...funnel.entries()].map(([stage, v]) => ({ stage, ...v })),
      quoteStats,
      goalProgress,
      inactiveCustomers,
    };
  });

const goalSchema = z.object({
  user_id: z.string().uuid().optional().or(z.literal("")),
  target_amount: z.coerce.number().min(0),
  period_start: z.string().min(1),
  period_end: z.string().min(1),
});

export const listGoals = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const [goalsRes, profilesRes] = await Promise.all([
      context.supabase.from("goals").select("*").order("period_start", { ascending: false }),
      context.supabase.from("profiles").select("id, full_name, email"),
    ]);
    if (goalsRes.error) throw new Error(goalsRes.error.message);
    return { goals: goalsRes.data ?? [], profiles: profilesRes.data ?? [] };
  });

export const createGoal = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => goalSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("goals").insert({
      user_id: data.user_id || null,
      target_amount: data.target_amount,
      period_start: data.period_start,
      period_end: data.period_end,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteGoal = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("goals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
