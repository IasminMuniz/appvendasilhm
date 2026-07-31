import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/supabase-auth.middleware";
import { z } from "zod";


const stageSchema = z.enum([
  "novo",
  "contato_realizado",
  "qualificado",
  "oportunidade",
  "proposta_enviada",
  "negociacao",
  "ganho",
  "perdido",
]);

const leadSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200),
  company: z.string().max(200).optional().or(z.literal("")),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
  state: z.string().max(50).optional().or(z.literal("")),
  source: z.string().max(100).optional().or(z.literal("")),
  stage: stageSchema.default("novo"),
  estimated_value: z.coerce.number().min(0).default(0),
  probability: z.coerce.number().int().min(0).max(100).default(0),
  next_action: z.string().max(300).optional().or(z.literal("")),
  next_action_date: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
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
        source: data.source || null,
        stage: data.stage,
        estimated_value: data.estimated_value,
        probability: data.probability,
        next_action: data.next_action || null,
        next_action_date: data.next_action_date || null,
        notes: data.notes || null,
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

    return inserted;
  });

export const updateLead = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => leadSchema.partial().extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase
      .from("leads")
      .update({
        ...rest,
        next_action_date: rest.next_action_date || null,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moveLeadStage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string; stage: string; note?: string }) =>
    z
      .object({
        id: z.string().uuid(),
        stage: stageSchema,
        note: z.string().max(500).optional().or(z.literal("")),
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

    const { error } = await context.supabase
      .from("leads")
      .update({ stage: data.stage })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await context.supabase.from("lead_stage_history").insert({
      lead_id: data.id,
      from_stage: current.stage,
      to_stage: data.stage,
      changed_by: context.userId,
      note: data.note || null,
    });

    return { ok: true };
  });

export const convertLeadToCustomer = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
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
        email: lead.email,
        phone: lead.phone,
        city: lead.city,
        state: lead.state,
        notes: lead.notes,
        seller_id: context.userId,
        owner_id: lead.owner_id,
        updated_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await context.supabase
      .from("leads")
      .update({ converted_customer_id: customer.id, stage: "ganho" })
      .eq("id", data.id);

    await context.supabase.from("lead_stage_history").insert({
      lead_id: data.id,
      from_stage: lead.stage,
      to_stage: "ganho",
      changed_by: context.userId,
      note: "Convertido em cliente",
    });

    return { customerId: customer.id };
  });

export const deleteLead = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("leads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
