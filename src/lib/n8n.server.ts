const N8N_WEBHOOK_URL = "https://iasminlhmuniz.app.n8n.cloud/webhook/nexus360-status";
/** Webhook de persistência do lead no PostgreSQL (Supabase) via n8n. */
const N8N_LEAD_PERSIST_URL = "https://iasminlhmuniz.app.n8n.cloud/webhook/nexus360-lead";

/**
 * POST do lead para o webhook de persistência no PostgreSQL.
 * Nunca lança erro: automações não podem quebrar o fluxo comercial.
 */
export async function postLeadPersistWebhook(
  body: Record<string, unknown>,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch(N8N_LEAD_PERSIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[n8n] webhook de persistência falhou [${res.status}]: ${text}`);
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 300)}` };
    }
    return { ok: true, error: null };
  } catch (error) {
    console.error("[n8n] erro ao chamar webhook de persistência:", error);
    return { ok: false, error: String(error).slice(0, 300) };
  }
}

/**
 * POST direto do lead (formato plano) para o webhook do n8n.
 * Nunca lança erro: automações não podem quebrar o fluxo comercial.
 */
export async function postLeadWebhook(body: Record<string, unknown>): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[n8n] webhook de lead falhou [${res.status}]: ${text}`);
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 300)}` };
    }
    return { ok: true, error: null };
  } catch (error) {
    console.error("[n8n] erro ao chamar webhook de lead:", error);
    return { ok: false, error: String(error).slice(0, 300) };
  }
}

/**
 * Envia um evento para o webhook do n8n. Nunca lança erro (não bloqueia o fluxo).
 * Retorna o resultado da entrega para registro no histórico de eventos.
 */
export async function notifyN8n(event: string, payload: unknown): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        sent_at: new Date().toISOString(),
        data: payload,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[n8n] webhook falhou [${res.status}]: ${text}`);
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 300)}` };
    }
    return { ok: true, error: null };
  } catch (error) {
    console.error("[n8n] erro ao chamar webhook:", error);
    return { ok: false, error: String(error).slice(0, 300) };
  }
}
