import { notifyN8n } from "@/lib/n8n.server";

/** Eventos internos do Nexus 360 (contrato usado pelas automações externas). */
export const NEXUS_EVENTS = {
  CLIENTE_CRIADO: "CLIENTE_CRIADO",
  CLIENTE_ATUALIZADO: "CLIENTE_ATUALIZADO",
  CLIENTE_INATIVO: "CLIENTE_INATIVO",
  LEAD_CRIADO: "LEAD_CRIADO",
  LEAD_ATUALIZADO: "LEAD_ATUALIZADO",
  LEAD_STATUS_ALTERADO: "LEAD_STATUS_ALTERADO",
  OPORTUNIDADE_CRIADA: "OPORTUNIDADE_CRIADA",
  OPORTUNIDADE_STATUS_ALTERADO: "OPORTUNIDADE_STATUS_ALTERADO",
  PEDIDO_STATUS_ALTERADO: "PEDIDO_STATUS_ALTERADO",
  VENDA_FECHADA: "VENDA_FECHADA",
} as const;

export type NexusEvent = (typeof NEXUS_EVENTS)[keyof typeof NEXUS_EVENTS];

type EventClient = {
  from: (table: string) => {
    insert: (values: Record<string, unknown>) => {
      select: (columns: string) => {
        single: () => Promise<{ data: { id: string } | null; error: unknown }>;
      };
    };
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: unknown }>;
    };
  };
};

/**
 * Registra um evento interno no histórico (commercial_events) e dispara o
 * webhook externo (n8n). Nunca lança erro: automações não podem quebrar o
 * fluxo comercial principal.
 */
export async function recordEvent(
  supabase: unknown,
  params: {
    eventType: NexusEvent | string;
    entityType: string;
    entityId?: string | null;
    payload?: Record<string, unknown>;
    userId: string;
  },
): Promise<void> {
  const client = supabase as EventClient;
  const payload = params.payload ?? {};
  let eventId: string | null = null;

  try {
    const { data, error } = await client
      .from("commercial_events")
      .insert({
        event_type: params.eventType,
        entity_type: params.entityType,
        entity_id: params.entityId ?? null,
        payload,
        created_by: params.userId,
        status: "pendente",
      })
      .select("id")
      .single();
    if (error) throw error;
    eventId = data?.id ?? null;
  } catch (error) {
    console.error("[events] falha ao registrar evento:", error);
  }

  const result = await notifyN8n(params.eventType, {
    evento: params.eventType,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    usuario_responsavel: params.userId,
    ocorrido_em: new Date().toISOString(),
    ...payload,
  });

  if (!eventId) return;
  try {
    await client
      .from("commercial_events")
      .update({
        status: result.ok ? "entregue" : "erro",
        delivered: result.ok,
        delivered_at: result.ok ? new Date().toISOString() : null,
        attempts: 1,
        last_error: result.error,
      })
      .eq("id", eventId);
  } catch (error) {
    console.error("[events] falha ao atualizar status de entrega:", error);
  }
}
