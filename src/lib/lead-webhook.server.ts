import { postLeadWebhook } from "@/lib/n8n.server";

/** Converte a etapa interna do funil para o status esperado pelo n8n. */
export function mapLeadStatus(stage: string | null | undefined): string {
  switch (stage) {
    case "proposta_enviada":
    case "negociacao":
      return "proposta_enviada";
    case "ganho":
    case "convertido":
      return "cliente_convertido";
    default:
      return "novo_lead";
  }
}

/**
 * Envia o lead para o webhook externo do n8n no formato contratado.
 * `payload` é o objeto produzido por buildLeadPayload.
 */
export async function sendLeadWebhook(
  payload: Record<string, unknown>,
  stage: string | null | undefined,
): Promise<void> {
  await postLeadWebhook({
    id: payload.lead_id ?? null,
    empresa: payload.empresa ?? null,
    contato: payload.contato ?? null,
    email: payload.email ?? null,
    telefone: payload.telefone ?? null,
    status: mapLeadStatus(stage),
    valor_proposta: Number(payload.valor_estimado ?? 0),
    vendedor: payload.responsavel ?? null,
    origem: payload.origem ?? null,
    observacoes: payload.observacoes ?? null,
  });
}
