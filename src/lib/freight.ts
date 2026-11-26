export interface FreightQuote {
  /** Código do serviço no Melhor Envio (usado para criar o envio). */
  service_id: number | null;
  transportadora: string;
  servico: string;
  preco: number;
  prazo_dias: number | null;
  logo: string | null;
}

/** Converte a resposta do Melhor Envio: descarta itens com erro e ordena pelo menor preço. */
export function parseQuotes(raw: unknown): FreightQuote[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((i: any) => i && !i.error)
    .map((i: any) => ({
      service_id: i.id != null && Number.isFinite(Number(i.id)) ? Number(i.id) : null,
      transportadora: String(i.company?.name ?? ""),
      servico: String(i.name ?? ""),
      preco: Number(i.custom_price ?? i.price ?? 0),
      prazo_dias: i.custom_delivery_time != null ? Number(i.custom_delivery_time) : null,
      logo: i.company?.picture ?? null,
    }))
    .filter((q) => Number.isFinite(q.preco) && q.preco > 0)
    .sort((a, b) => a.preco - b.preco);
}

export function freightSummary(cep: string, quotes: FreightQuote[]): string {
  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const lines = quotes.map(
    (q) =>
      `• ${q.transportadora} ${q.servico}: ${fmt(q.preco)}${q.prazo_dias != null ? ` – ${q.prazo_dias} dia(s) úteis` : ""}`,
  );
  return `Opções de frete para o CEP ${cep}:\n${lines.join("\n")}`;
}

/** Tenta separar número e bairro de um endereço digitado numa linha só ("Rua X, 123 - Bairro"). */
export function splitAddress(address: string): {
  street: string;
  number: string;
  district: string;
  complement: string;
} {
  const a = address.trim();
  const m = a.match(/^(.*?),\s*(\d+[A-Za-z]?|s\/?n)\b\s*(?:,\s*([^-]*?))?\s*(?:-\s*(.+))?$/i);
  if (!m) return { street: a, number: "", district: "", complement: "" };
  return {
    street: m[1].trim(),
    number: m[2].trim(),
    complement: (m[3] ?? "").trim(),
    district: (m[4] ?? "").trim(),
  };
}
