import { notifyN8n } from "@/lib/n8n.server";

type EventClient = {
  from: (table: string) => {
    insert: (values: Record<string, unknown>) => Promise<{ error: unknown }>;
  };
};

/**
 * Registra um evento comercial no banco e dispara o webhook (n8n).
 * Nunca lança erro: automações não podem quebrar o fluxo principal.
 */
export async function recordEvent(
  supabase: unknown,
  params: {
    eventType: string;
    entityType: string;
    entityId?: string | null;
    payload?: Record<string, unknown>;
    userId: string;
  },
): Promise<void> {
  try {
    const client = supabase as EventClient;
    await client.from("commercial_events").insert({
      event_type: params.eventType,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      payload: params.payload ?? {},
      created_by: params.userId,
    });
  } catch (error) {
    console.error("[events] falha ao registrar evento:", error);
  }

  await notifyN8n(params.eventType, {
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    user_id: params.userId,
    ...(params.payload ?? {}),
  });
}
