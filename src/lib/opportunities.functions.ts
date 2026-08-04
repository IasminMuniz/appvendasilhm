import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/supabase-auth.middleware";
import { z } from "zod";

const statusSchema = z.enum(["aberta", "em_negociacao", "ganha", "perdida"]);

const opportunitySchema = z.object({
  title: z.string().min(1, "Título é obrigatório").max(200),
  customer_id: z.string().uuid().optional().or(z.literal("")),
  lead_id: z.string().uuid().optional().or(z.literal("")),
  product_id: z.string().uuid().optional().or(z.literal("")),
  product_description: z.string().max(500).optional().or(z.literal("")),
  amount: z.coerce.number().min(0).default(0),
  status: statusSchema.default("aberta"),
  expected_close_date: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

const PROBABILITY: Record<string, number> = {
  aberta: 30,
  em_negociacao: 70,
  ganha: 100,
  perdida: 0,
};

export const listOpportunities = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("opportunities")
      .select("*, customers(name, company_name), leads(name, company), products(name)")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createOpportunity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => opportunitySchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: inserted, error } = await context.supabase
      .from("opportunities")
      .insert({
        title: data.title,
        customer_id: data.customer_id || null,
        lead_id: data.lead_id || null,
        product_id: data.product_id || null,
        product_description: data.product_description || null,
        amount: data.amount,
        status: data.status,
        probability: PROBABILITY[data.status] ?? 30,
        expected_close_date: data.expected_close_date || null,
        notes: data.notes || null,
        owner_id: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const { touchActivity } = await import("@/lib/activity.server");
    await touchActivity(context.supabase, {
      leadId: inserted.lead_id,
      customerId: inserted.customer_id,
      userId: context.userId,
    });

    const { recordEvent } = await import("@/lib/events.server");
    await recordEvent(context.supabase, {
      eventType: "OPORTUNIDADE_CRIADA",
      entityType: "opportunity",
      entityId: inserted.id,
      payload: {
        oportunidade_id: inserted.id,
        cliente_id: inserted.customer_id,
        valor: Number(inserted.amount ?? 0),
        responsavel_id: inserted.owner_id,
        status: inserted.status,
        criado_em: inserted.created_at,
      },
      userId: context.userId,
    });

    return inserted;
  });

export const updateOpportunity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => opportunitySchema.partial().extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { id, status, ...rest } = data;
    const patch = {
      ...rest,
      customer_id: rest.customer_id || null,
      lead_id: rest.lead_id || null,
      product_id: rest.product_id || null,
      expected_close_date: rest.expected_close_date || null,
      ...(status ? { status, probability: PROBABILITY[status] ?? 30 } : {}),
    };
    const { error } = await context.supabase.from("opportunities").update(patch).eq("id", id);

    if (error) throw new Error(error.message);

    if (status) {
      const { data: current } = await context.supabase
        .from("opportunities")
        .select("lead_id, customer_id")
        .eq("id", id)
        .maybeSingle();
      const { touchActivity } = await import("@/lib/activity.server");
      await touchActivity(context.supabase, {
        leadId: current?.lead_id,
        customerId: current?.customer_id,
        userId: context.userId,
      });

      const { recordEvent } = await import("@/lib/events.server");
      await recordEvent(context.supabase, {
        eventType: "OPORTUNIDADE_STATUS_ALTERADO",
        entityType: "opportunity",
        entityId: id,
        payload: {
          novo_status: status,
          alterado_por: context.userId,
          alterado_em: new Date().toISOString(),
          probabilidade: PROBABILITY[status] ?? 30,
        },
        userId: context.userId,
      });

      if (status === "ganha") {
        const { data: opp } = await context.supabase
          .from("opportunities")
          .select("id, customer_id, amount, owner_id")
          .eq("id", id)
          .single();
        await recordEvent(context.supabase, {
          eventType: "VENDA_FECHADA",
          entityType: "opportunity",
          entityId: id,
          payload: {
            cliente_id: opp?.customer_id ?? null,
            valor_vendido: Number(opp?.amount ?? 0),
            responsavel_id: opp?.owner_id ?? context.userId,
            data_venda: new Date().toISOString(),
            origem: "oportunidade",
          },
          userId: context.userId,
        });
      }
    }
    return { ok: true };
  });

export const deleteOpportunity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("opportunities").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Converte um lead em oportunidade mantendo o histórico do lead. */
export const convertLeadToOpportunity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { lead_id: string }) =>
    z.object({ lead_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: lead, error: readError } = await context.supabase
      .from("leads")
      .select("*")
      .eq("id", data.lead_id)
      .single();
    if (readError) throw new Error(readError.message);

    const { data: existing } = await context.supabase
      .from("opportunities")
      .select("id")
      .eq("lead_id", data.lead_id)
      .maybeSingle();
    if (existing) return { id: existing.id, alreadyExists: true };

    const { data: inserted, error } = await context.supabase
      .from("opportunities")
      .insert({
        title: lead.company || lead.name,
        lead_id: lead.id,
        customer_id: lead.converted_customer_id,
        amount: lead.estimated_value ?? 0,
        status: "aberta",
        probability: lead.probability ?? 30,
        expected_close_date: lead.expected_close_date,
        notes: lead.notes,
        owner_id: lead.owner_id ?? context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("lead_stage_history").insert({
      lead_id: lead.id,
      from_stage: lead.stage,
      to_stage: lead.stage,
      changed_by: context.userId,
      note: "Lead convertido em oportunidade",
    });

    const { recordEvent } = await import("@/lib/events.server");
    await recordEvent(context.supabase, {
      eventType: "OPORTUNIDADE_CRIADA",
      entityType: "opportunity",
      entityId: inserted.id,
      payload: {
        oportunidade_id: inserted.id,
        cliente_id: inserted.customer_id,
        valor: Number(inserted.amount ?? 0),
        responsavel_id: inserted.owner_id,
        status: inserted.status,
        criado_em: inserted.created_at,
        origem_lead_id: lead.id,
      },
      userId: context.userId,
    });

    return { id: inserted.id, alreadyExists: false };
  });
