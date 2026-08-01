const N8N_WEBHOOK_URL = "https://iasminlhmuniz.app.n8n.cloud/webhook-test/novo_lead";

/** Envia um evento para o webhook do n8n. Nunca lança erro (não bloqueia o fluxo). */
export async function notifyN8n(event: string, payload: unknown): Promise<void> {
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
      console.error(`[n8n] webhook falhou [${res.status}]: ${await res.text()}`);
    }
  } catch (error) {
    console.error("[n8n] erro ao chamar webhook:", error);
  }
}
