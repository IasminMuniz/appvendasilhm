import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/supabase-auth.middleware";
import { z } from "zod";

const customerSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200),
  legal_name: z.string().max(200).optional().or(z.literal("")),
  company_name: z.string().max(200).optional().or(z.literal("")),
  document: z.string().max(40).optional().or(z.literal("")),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
  state: z.string().max(50).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  segment: z.string().max(60).optional().or(z.literal("")),
  company_size: z.string().max(40).optional().or(z.literal("")),
  region: z.string().max(60).optional().or(z.literal("")),
  status: z.enum(["prospect", "ativo", "inativo", "perdido"]).default("prospect"),
});


export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("customers")
      .select("*")
      .order("name");

    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createCustomer = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => customerSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: inserted, error } = await context.supabase
      .from("customers")
      .insert({
        name: data.name,
        legal_name: data.legal_name || null,
        company_name: data.company_name || null,
        document: data.document || null,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        notes: data.notes || null,
        segment: data.segment || null,
        company_size: data.company_size || null,
        region: data.region || null,
        status: data.status,
        last_activity_at: new Date().toISOString(),
        seller_id: context.userId,
        owner_id: context.userId,
        updated_by: context.userId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    const { recordEvent } = await import("@/lib/events.server");
    await recordEvent(context.supabase, {
      eventType: "novo_cliente",
      entityType: "customer",
      entityId: inserted.id,
      payload: { customer: inserted },
      userId: context.userId,
    });


    return inserted;
  });

export const getCustomer = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: customer, error } = await context.supabase
      .from("customers")
      .select("*")
      .eq("id", data.id)
      .single();

    if (error) throw new Error(error.message);
    return customer;
  });

export const updateCustomer = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => customerSchema.extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase
      .from("customers")
      .update({
        name: rest.name,
        legal_name: rest.legal_name || null,
        company_name: rest.company_name || null,
        document: rest.document || null,
        email: rest.email || null,
        phone: rest.phone || null,
        address: rest.address || null,
        city: rest.city || null,
        state: rest.state || null,
        notes: rest.notes || null,
        segment: rest.segment || null,
        company_size: rest.company_size || null,
        region: rest.region || null,
        status: rest.status,
        updated_by: context.userId,

      })
      .eq("id", id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const changeCustomerOwner = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string; owner_id: string; note?: string }) =>
    z
      .object({
        id: z.string().uuid(),
        owner_id: z.string().uuid(),
        note: z.string().max(500).optional().or(z.literal("")),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: current, error: readError } = await context.supabase
      .from("customers")
      .select("owner_id, seller_id")
      .eq("id", data.id)
      .single();
    if (readError) throw new Error(readError.message);

    const previous = current.owner_id ?? current.seller_id;

    const { error } = await context.supabase
      .from("customers")
      .update({ owner_id: data.owner_id, updated_by: context.userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await context.supabase.from("customer_owner_history").insert({
      customer_id: data.id,
      previous_owner_id: previous,
      new_owner_id: data.owner_id,
      changed_by: context.userId,
      note: data.note || null,
    });

    return { ok: true };
  });

export const addCustomerInteraction = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { customer_id: string; kind: string; content: string }) =>
    z
      .object({
        customer_id: z.string().uuid(),
        kind: z.string().max(40).default("nota"),
        content: z.string().min(1, "Descreva a interação").max(2000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("customer_interactions").insert({
      customer_id: data.customer_id,
      kind: data.kind,
      content: data.content,
      user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Ficha completa do cliente: cadastro, responsável, histórico, pedidos e indicadores. */
export const getCustomerDetail = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    const [
      customerRes,
      ownerHistoryRes,
      interactionsRes,
      ordersRes,
      profilesRes,
      contactsRes,
      actionsRes,
      leadsRes,
      quotesRes,
    ] = await Promise.all([
      supabase.from("customers").select("*").eq("id", data.id).single(),
      supabase
        .from("customer_owner_history")
        .select("*")
        .eq("customer_id", data.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("customer_interactions")
        .select("*")
        .eq("customer_id", data.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select("*, order_items(*, products(name))")
        .eq("customer_id", data.id)
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, email"),
      supabase
        .from("customer_contacts")
        .select("*")
        .eq("customer_id", data.id)
        .order("is_primary", { ascending: false })
        .order("name"),
      supabase
        .from("customer_next_actions")
        .select("*")
        .eq("customer_id", data.id)
        .order("due_date", { ascending: true, nullsFirst: false }),
      supabase
        .from("leads")
        .select("*")
        .eq("converted_customer_id", data.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("quotes")
        .select("id, number, status, total, created_at, valid_until")
        .eq("customer_id", data.id)
        .order("created_at", { ascending: false }),
    ]);

    if (customerRes.error) throw new Error(customerRes.error.message);

    const orders = ordersRes.data ?? [];
    const cancelled = new Set(["cancelado"]);
    const validOrders = orders.filter((o) => !cancelled.has(o.status as string));

    const totalRevenue = validOrders.reduce((sum, o) => sum + Number(o.total ?? 0), 0);
    const lastOrder = validOrders[0] ?? null;
    const averageTicket = validOrders.length ? totalRevenue / validOrders.length : 0;

    const firstDate = validOrders.length
      ? new Date(validOrders[validOrders.length - 1]!.created_at as string)
      : null;
    const months = firstDate
      ? Math.max(
          1,
          (new Date().getFullYear() - firstDate.getFullYear()) * 12 +
            (new Date().getMonth() - firstDate.getMonth()) +
            1,
        )
      : 1;
    const monthlyAverage = totalRevenue / months;

    const productTotals = new Map<string, { name: string; quantity: number; total: number }>();
    for (const order of validOrders) {
      for (const item of order.order_items ?? []) {
        const name = item.products?.name ?? "Produto";
        const entry = productTotals.get(name) ?? { name, quantity: 0, total: 0 };
        entry.quantity += Number(item.quantity ?? 0);
        entry.total += Number(item.total ?? 0);
        productTotals.set(name, entry);
      }
    }
    const topProducts = [...productTotals.values()].sort((a, b) => b.total - a.total).slice(0, 5);

    const daysSinceLast = lastOrder
      ? Math.floor(
          (Date.now() - new Date(lastOrder.created_at as string).getTime()) / (1000 * 60 * 60 * 24),
        )
      : null;

    let health: "saudavel" | "atencao" | "risco" | "inativo" = "inativo";
    if (daysSinceLast === null) health = "inativo";
    else if (daysSinceLast <= 45) health = "saudavel";
    else if (daysSinceLast <= 90) health = "atencao";
    else health = "risco";

    const profileMap = Object.fromEntries(
      (profilesRes.data ?? []).map((p) => [p.id, p.full_name || p.email || "Usuário"]),
    );

    return {
      customer: customerRes.data,
      ownerHistory: (ownerHistoryRes.data ?? []).map((h) => ({
        ...h,
        previous_owner_name: h.previous_owner_id ? profileMap[h.previous_owner_id] ?? null : null,
        new_owner_name: h.new_owner_id ? profileMap[h.new_owner_id] ?? null : null,
        changed_by_name: profileMap[h.changed_by] ?? null,
      })),
      interactions: (interactionsRes.data ?? []).map((i) => ({
        ...i,
        user_name: profileMap[i.user_id] ?? null,
      })),
      orders,
      contacts: contactsRes.data ?? [],
      nextActions: (actionsRes.data ?? []).map((a) => ({
        ...a,
        assigned_to_name: profileMap[a.assigned_to] ?? null,
      })),
      opportunities: leadsRes.data ?? [],
      quotes: quotesRes.data ?? [],
      timeline: [
        ...(interactionsRes.data ?? []).map((i) => ({
          id: `i-${i.id}`,
          type: "interacao" as const,
          date: i.created_at as string,
          title: `Interação · ${i.kind}`,
          description: i.content as string,
        })),
        ...orders.map((o) => ({
          id: `o-${o.id}`,
          type: "pedido" as const,
          date: o.created_at as string,
          title: `Pedido ${o.status}`,
          description: `Total ${Number(o.total ?? 0).toFixed(2)}`,
        })),
        ...(quotesRes.data ?? []).map((q) => ({
          id: `q-${q.id}`,
          type: "orcamento" as const,
          date: q.created_at as string,
          title: `Orçamento #${q.number} · ${q.status}`,
          description: `Total ${Number(q.total ?? 0).toFixed(2)}`,
        })),
        ...(ownerHistoryRes.data ?? []).map((h) => ({
          id: `h-${h.id}`,
          type: "carteira" as const,
          date: h.created_at as string,
          title: "Troca de responsável",
          description: `${h.previous_owner_id ? profileMap[h.previous_owner_id] ?? "—" : "—"} → ${
            h.new_owner_id ? profileMap[h.new_owner_id] ?? "—" : "—"
          }`,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      sellers: profilesRes.data ?? [],
      ownerName:
        profileMap[customerRes.data.owner_id ?? customerRes.data.seller_id] ?? "Não definido",
      metrics: {
        ordersCount: validOrders.length,
        totalRevenue,
        lastOrderDate: lastOrder?.created_at ?? null,
        lastOrderValue: lastOrder ? Number(lastOrder.total ?? 0) : 0,
        monthlyAverage,
        averageTicket,
        topProducts,
        daysSinceLast,
        health,
      },
    };
  });

/* ============ Contatos do cliente ============ */

const contactSchema = z.object({
  customer_id: z.string().uuid(),
  name: z.string().min(1, "Nome é obrigatório").max(120),
  role: z.string().max(120).optional().or(z.literal("")),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  is_primary: z.boolean().default(false),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export const addCustomerContact = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => contactSchema.parse(data))
  .handler(async ({ data, context }) => {
    if (data.is_primary) {
      await context.supabase
        .from("customer_contacts")
        .update({ is_primary: false })
        .eq("customer_id", data.customer_id);
    }
    const { error } = await context.supabase.from("customer_contacts").insert({
      customer_id: data.customer_id,
      name: data.name,
      role: data.role || null,
      email: data.email || null,
      phone: data.phone || null,
      is_primary: data.is_primary,
      notes: data.notes || null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCustomerContact = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("customer_contacts")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ Próximas ações ============ */

export const addCustomerNextAction = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(
    (data: {
      customer_id: string;
      title: string;
      description?: string;
      due_date?: string;
      assigned_to?: string;
    }) =>
      z
        .object({
          customer_id: z.string().uuid(),
          title: z.string().min(1, "Informe a ação").max(200),
          description: z.string().max(1000).optional().or(z.literal("")),
          due_date: z.string().optional().or(z.literal("")),
          assigned_to: z.string().uuid().optional().or(z.literal("")),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("customer_next_actions").insert({
      customer_id: data.customer_id,
      title: data.title,
      description: data.description || null,
      due_date: data.due_date || null,
      assigned_to: data.assigned_to || context.userId,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateCustomerNextActionStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string; status: string }) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pendente", "concluida", "cancelada"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("customer_next_actions")
      .update({
        status: data.status,
        completed_at: data.status === "concluida" ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Exclui um cliente definitivamente (permitido a gestores/admin conforme RLS). */
export const deleteCustomer = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("customers").delete().eq("id", data.id);
    if (error) {
      if (error.code === "23503")
        throw new Error("Não é possível excluir: existem pedidos ou orçamentos vinculados a este cliente.");
      throw new Error(error.message);
    }
    return { ok: true };
  });
