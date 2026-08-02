import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/supabase-auth.middleware";
import { STAGE_FORECAST_DAYS, STAGE_PROBABILITY } from "@/lib/commercial-constants";
import { z } from "zod";
import { cepSchema, phoneSchema } from "@/lib/masks";

const stageSchema = z.enum([
  "novo",
  "contato_realizado",
  "qualificado",
  "reuniao",
  "oportunidade",
  "proposta_enviada",
  "negociacao",
  "ganho",
  "convertido",
  "perdido",
]);

/** Probabilidade derivada automaticamente da etapa. */
function probabilityFor(stage: string): number {
  return STAGE_PROBABILITY[stage] ?? 0;
}

/** Previsão automática de fechamento (data atual + dias da etapa). */
function forecastFor(stage: string): string | null {
  const days = STAGE_FORECAST_DAYS[stage];
  if (days === undefined) return null;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const leadSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200),
  company: z.string().max(200).optional().or(z.literal("")),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: phoneSchema.optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
  state: z.string().max(50).optional().or(z.literal("")),
  postal_code: cepSchema.optional().or(z.literal("")),
  segment: z.string().max(60).optional().or(z.literal("")),
  source: z.string().max(100).optional().or(z.literal("")),
  stage: stageSchema.default("novo"),
  estimated_value: z.coerce.number().min(0).default(0),
  next_action: z.string().max(300).optional().or(z.literal("")),
  next_action_date: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  loss_reason: z.string().max(120).optional().or(z.literal("")),
  loss_detail: z.string().max(1000).optional().or(z.literal("")),
  expected_close_date: z.string().optional().or(z.literal("")),
});


export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("leads")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getLead = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const [leadRes, historyRes] = await Promise.all([
      context.supabase.from("leads").select("*").eq("id", data.id).single(),
      context.supabase
        .from("lead_stage_history")
        .select("*")
        .eq("lead_id", data.id)
        .order("created_at", { ascending: false }),
    ]);
    if (leadRes.error) throw new Error(leadRes.error.message);
    return { lead: leadRes.data, history: historyRes.data ?? [] };
  });

export const createLead = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => leadSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: inserted, error } = await context.supabase
      .from("leads")
      .insert({
        name: data.name,
        company: data.company || null,
        email: data.email || null,
        phone: data.phone || null,
        city: data.city || null,
        state: data.state || null,
        postal_code: data.postal_code || null,
        segment: data.segment || null,
        source: data.source || null,
        stage: data.stage,
        estimated_value: data.estimated_value,
        probability: probabilityFor(data.stage),
        next_action: data.next_action || null,
        next_action_date: data.next_action_date || null,
        notes: data.notes || null,
        expected_close_date: data.expected_close_date || forecastFor(data.stage),
        last_activity_at: new Date().toISOString(),
        owner_id: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("lead_stage_history").insert({
      lead_id: inserted.id,
      from_stage: null,
      to_stage: data.stage,
      changed_by: context.userId,
      note: "Lead criado",
    });

    const { recordEvent } = await import("@/lib/events.server");
    const { buildLeadPayload } = await import("@/lib/lead-payload.server");
    const { sendLeadWebhook } = await import("@/lib/lead-webhook.server");
    const payload = await buildLeadPayload(context.supabase, inserted);
    await recordEvent(context.supabase, {
      eventType: "LEAD_CRIADO",
      entityType: "lead",
      entityId: inserted.id,
      payload,
      userId: context.userId,
    });
    await sendLeadWebhook(payload, inserted.stage);

    return inserted;
  });

export const updateLead = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => leadSchema.partial().extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { data: previous } = await context.supabase
      .from("leads")
      .select("stage")
      .eq("id", id)
      .maybeSingle();
    const { error } = await context.supabase
      .from("leads")
      .update({
        ...rest,
        next_action_date: rest.next_action_date || null,
        // previsão pode ser ajustada manualmente pelo vendedor
        expected_close_date: rest.expected_close_date || null,
        ...(rest.stage ? { probability: probabilityFor(rest.stage) } : {}),
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);

    const { data: updated } = await context.supabase
      .from("leads")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    const { recordEvent } = await import("@/lib/events.server");
    const { buildLeadPayload } = await import("@/lib/lead-payload.server");
    const payload = await buildLeadPayload(context.supabase, updated ?? { id, ...rest });
    await recordEvent(context.supabase, {
      eventType: "LEAD_ATUALIZADO",
      entityType: "lead",
      entityId: id,
      payload,
      userId: context.userId,
    });

    const stageChanged = rest.stage && previous?.stage && previous.stage !== rest.stage;
    if (stageChanged) {
      await recordEvent(context.supabase, {
        eventType: "LEAD_STATUS_ALTERADO",
        entityType: "lead",
        entityId: id,
        payload: {
          ...payload,
          status_anterior: previous?.stage ?? null,
          novo_status: rest.stage,
          alterado_por: context.userId,
          alterado_em: new Date().toISOString(),
        },
        userId: context.userId,
      });
      const { sendLeadWebhook } = await import("@/lib/lead-webhook.server");
      await sendLeadWebhook(payload, rest.stage);
    }

    return { ok: true };
  });



export const moveLeadStage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(
    (data: {
      id: string;
      stage: string;
      note?: string;
      loss_reason?: string;
      loss_detail?: string;
    }) =>
      z
        .object({
          id: z.string().uuid(),
          stage: stageSchema,
          note: z.string().max(500).optional().or(z.literal("")),
          loss_reason: z.string().max(120).optional().or(z.literal("")),
          loss_detail: z.string().max(1000).optional().or(z.literal("")),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: current, error: readError } = await context.supabase
      .from("leads")
      .select("stage")
      .eq("id", data.id)
      .single();
    if (readError) throw new Error(readError.message);
    if (current.stage === data.stage) return { ok: true };

    if (data.stage === "perdido" && !data.loss_reason) {
      throw new Error("Informe o motivo da perda para mover a oportunidade.");
    }

    const forecast = forecastFor(data.stage);
    const { error } = await context.supabase
      .from("leads")
      .update({
        stage: data.stage,
        probability: probabilityFor(data.stage),
        ...(forecast ? { expected_close_date: forecast } : {}),
        last_activity_at: new Date().toISOString(),
        loss_reason: data.stage === "perdido" ? data.loss_reason : null,
        loss_detail: data.stage === "perdido" ? data.loss_detail || null : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await context.supabase.from("lead_stage_history").insert({
      lead_id: data.id,
      from_stage: current.stage,
      to_stage: data.stage,
      changed_by: context.userId,
      note:
        data.note ||
        (data.loss_reason
          ? `Perda: ${data.loss_reason}`
          : `Probabilidade atualizada para ${probabilityFor(data.stage)}%`),
    });

    const { data: updated } = await context.supabase
      .from("leads")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();

    const { recordEvent } = await import("@/lib/events.server");
    const { buildLeadPayload } = await import("@/lib/lead-payload.server");
    const { sendLeadWebhook } = await import("@/lib/lead-webhook.server");
    const statusPayload = await buildLeadPayload(context.supabase, updated ?? { id: data.id }, {
      status_anterior: current.stage,
      novo_status: data.stage,
      alterado_por: context.userId,
      alterado_em: new Date().toISOString(),
      probabilidade: probabilityFor(data.stage),
      expected_close_date: forecast,
      note: data.note || null,
      loss_reason: data.loss_reason || null,
    });
    await recordEvent(context.supabase, {
      eventType: "LEAD_STATUS_ALTERADO",
      entityType: "lead",
      entityId: data.id,
      payload: statusPayload,
      userId: context.userId,
    });
    await sendLeadWebhook(statusPayload, data.stage);




    if (data.stage === "ganho") {
      const { data: lead } = await context.supabase
        .from("leads")
        .select("id, name, company, estimated_value, owner_id, converted_customer_id")
        .eq("id", data.id)
        .single();
      await recordEvent(context.supabase, {
        eventType: "VENDA_FECHADA",
        entityType: "lead",
        entityId: data.id,
        payload: {
          cliente_id: lead?.converted_customer_id ?? null,
          cliente_nome: lead?.company || lead?.name || null,
          valor_vendido: Number(lead?.estimated_value ?? 0),
          responsavel_id: lead?.owner_id ?? context.userId,
          data_venda: new Date().toISOString(),
          origem: "lead",
        },
        userId: context.userId,
      });
    }

    return { ok: true };
  });

/** Indicadores do funil: valores por etapa, previsão ponderada, conversão e tempo médio. */
export const getPipelineMetrics = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const [leadsRes, historyRes] = await Promise.all([
      context.supabase.from("leads").select("*"),
      context.supabase.from("lead_stage_history").select("lead_id, to_stage, created_at"),
    ]);
    const leads = leadsRes.data ?? [];
    const history = historyRes.data ?? [];

    const open = leads.filter(
      (l) => l.stage !== "ganho" && l.stage !== "perdido" && l.stage !== "convertido",
    );
    const won = leads.filter((l) => l.stage === "ganho" || l.stage === "convertido");
    const lost = leads.filter((l) => l.stage === "perdido");

    const byStage = new Map<string, { count: number; value: number }>();
    for (const l of leads) {
      const e = byStage.get(l.stage) ?? { count: 0, value: 0 };
      e.count += 1;
      e.value += Number(l.estimated_value ?? 0);
      byStage.set(l.stage, e);
    }

    // Tempo médio de fechamento (criação -> ganho)
    const createdAt = new Map(leads.map((l) => [l.id, l.created_at as string]));
    const wonEvents = history.filter((h) => h.to_stage === "ganho");
    const durations = wonEvents
      .map((h) => {
        const start = createdAt.get(h.lead_id);
        if (!start) return null;
        return (new Date(h.created_at).getTime() - new Date(start).getTime()) / 86400000;
      })
      .filter((v): v is number => v !== null && v >= 0);
    const averageCycleDays = durations.length
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    const lossByReason = new Map<string, number>();
    for (const l of lost) {
      const reason = (l.loss_reason as string | null) ?? "Não informado";
      lossByReason.set(reason, (lossByReason.get(reason) ?? 0) + 1);
    }

    return {
      openCount: open.length,
      openValue: open.reduce((s, l) => s + Number(l.estimated_value ?? 0), 0),
      forecast: open.reduce(
        (s, l) => s + (Number(l.estimated_value ?? 0) * Number(l.probability ?? 0)) / 100,
        0,
      ),
      wonCount: won.length,
      lostCount: lost.length,
      conversionRate: won.length + lost.length ? (won.length / (won.length + lost.length)) * 100 : 0,
      averageCycleDays,
      byStage: [...byStage.entries()].map(([stage, v]) => ({ stage, ...v })),
      lossReasons: [...lossByReason.entries()]
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count),
    };
  });

export const convertLeadToCustomer = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    // A leitura passa pelas políticas RBAC: vendedor só enxerga os próprios leads,
    // supervisor/gestor os da equipe e administrador todos.
    const { data: lead, error: readError } = await context.supabase
      .from("leads")
      .select("*")
      .eq("id", data.id)
      .single();
    if (readError) throw new Error(readError.message);
    if (lead.converted_customer_id) return { customerId: lead.converted_customer_id };

    const { data: customer, error } = await context.supabase
      .from("customers")
      .insert({
        name: lead.company || lead.name,
        company_name: lead.company,
        legal_name: lead.company,
        email: lead.email,
        phone: lead.phone,
        city: lead.city,
        state: lead.state,
        postal_code: lead.postal_code,
        segment: lead.segment,
        notes: lead.notes,
        status: "ativo",
        last_activity_at: new Date().toISOString(),
        seller_id: lead.owner_id ?? context.userId,
        owner_id: lead.owner_id ?? context.userId,
        updated_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Contato principal do lead vira contato do cliente.
    if (lead.name) {
      await context.supabase.from("customer_contacts").insert({
        customer_id: customer.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        is_primary: true,
        notes: "Contato originado do lead convertido",
        created_by: context.userId,
      });
    }

    // Histórico de interações do lead passa a pertencer ao cliente.
    await context.supabase
      .from("customer_interactions")
      .update({ customer_id: customer.id })
      .eq("lead_id", data.id);

    const convertedAt = new Date().toISOString();
    const { error: updateError } = await context.supabase
      .from("leads")
      .update({
        converted_customer_id: customer.id,
        stage: "convertido",
        probability: 100,
        converted_at: convertedAt,
        converted_by: context.userId,
        last_activity_at: convertedAt,
      })
      .eq("id", data.id);
    if (updateError) throw new Error(updateError.message);

    await context.supabase.from("lead_stage_history").insert({
      lead_id: data.id,
      from_stage: lead.stage,
      to_stage: "convertido",
      changed_by: context.userId,
      note: `Convertido em cliente ${customer.name}`,
    });

    const { recordEvent } = await import("@/lib/events.server");
    await recordEvent(context.supabase, {
      eventType: "VENDA_FECHADA",
      entityType: "lead",
      entityId: data.id,
      payload: {
        lead_id: data.id,
        cliente_id: customer.id,
        cliente_nome: customer.name,
        responsavel_id: lead.owner_id ?? context.userId,
        convertido_por: context.userId,
        convertido_em: convertedAt,
        estado: customer.state,
        cidade: customer.city,
        cep: customer.postal_code,
        valor_estimado: Number(lead.estimated_value ?? 0),
        origem: "conversao_lead",
      },
      userId: context.userId,
    });

    return { customerId: customer.id };
  });

/** Indicadores de BI por localização: leads por estado, clientes por cidade e conversão por região. */
export const getLocationAnalytics = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const [leadsRes, customersRes] = await Promise.all([
      context.supabase
        .from("leads")
        .select("state, city, stage, estimated_value, owner_id, converted_customer_id"),
      context.supabase.from("customers").select("state, city, owner_id, seller_id"),
    ]);
    const leads = leadsRes.data ?? [];
    const customers = customersRes.data ?? [];

    const group = <T,>(rows: T[], key: (row: T) => string) => {
      const map = new Map<string, number>();
      for (const row of rows) {
        const k = key(row) || "Não informado";
        map.set(k, (map.get(k) ?? 0) + 1);
      }
      return [...map.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count);
    };

    const byRegion = new Map<string, { leads: number; converted: number; value: number }>();
    for (const l of leads) {
      const key = (l.state as string | null) || "Não informado";
      const entry = byRegion.get(key) ?? { leads: 0, converted: 0, value: 0 };
      entry.leads += 1;
      if (l.converted_customer_id || l.stage === "convertido" || l.stage === "ganho") {
        entry.converted += 1;
        entry.value += Number(l.estimated_value ?? 0);
      }
      byRegion.set(key, entry);
    }

    return {
      leadsByState: group(leads, (l) => (l.state as string | null) ?? ""),
      customersByCity: group(customers, (c) => (c.city as string | null) ?? ""),
      customersByState: group(customers, (c) => (c.state as string | null) ?? ""),
      conversionByRegion: [...byRegion.entries()]
        .map(([state, v]) => ({
          state,
          ...v,
          rate: v.leads ? (v.converted / v.leads) * 100 : 0,
        }))
        .sort((a, b) => b.leads - a.leads),
    };
  });

export const deleteLead = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("leads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
