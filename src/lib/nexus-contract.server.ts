/**
 * Contrato oficial de dados do Nexus 360.
 *
 * Todo payload enviado ao n8n (webhooks de lead, de persistência e de eventos)
 * DEVE conter exatamente estas 16 chaves, mesmo que com valor null.
 * Campos adicionais já existentes continuam sendo enviados como complemento,
 * para não quebrar fluxos/automações atuais.
 */
export type NexusContract = {
  evento: string | null;
  id_cliente: string | null;
  id_lead: string | null;
  nome_cliente: string | null;
  nome_lead: string | null;
  empresa: string | null;
  email: string | null;
  telefone: string | null;
  responsavel: string | null;
  status: string | null;
  origem_lead: string | null;
  ultima_interacao: string | null;
  /** Sempre presente; calculado externamente pelo n8n. */
  dias_sem_interacao: number | null;
  data_criacao: string | null;
  mensagem: string | null;
};

export const NEXUS_CONTRACT_KEYS = [
  "evento",
  "id_cliente",
  "id_lead",
  "nome_cliente",
  "nome_lead",
  "empresa",
  "email",
  "telefone",
  "responsavel",
  "status",
  "origem_lead",
  "ultima_interacao",
  "dias_sem_interacao",
  "data_criacao",
  "mensagem",
] as const;

type Row = Record<string, unknown> | null | undefined;

const str = (value: unknown): string | null => {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
};

const pick = (source: Row, ...keys: string[]): string | null => {
  if (!source) return null;
  for (const key of keys) {
    const value = str(source[key]);
    if (value !== null) return value;
  }
  return null;
};

export type BuildContractInput = {
  evento?: string | null;
  /** Registro de `leads` (quando houver). */
  lead?: Row;
  /** Registro de `customers` (quando houver). */
  customer?: Row;
  /** Nome do responsável (profiles.full_name) já resolvido. */
  responsavel?: string | null;
  /** Texto livre da interação: observação, nota, motivo, mensagem enviada. */
  mensagem?: string | null;
  /** Sobrescritas pontuais (ex.: status já mapeado para o n8n). */
  overrides?: Partial<NexusContract>;
};

/**
 * Mapeador único do contrato. Reutiliza os campos já existentes no banco:
 * leads.name/company/source/stage/last_activity_at/created_at e
 * customers.name/company_name/status/last_activity_at/created_at.
 */
export function buildNexusContract(input: BuildContractInput): NexusContract {
  const { lead, customer } = input;

  const contract: NexusContract = {
    evento: str(input.evento),
    id_cliente: pick(customer, "id") ?? pick(lead, "converted_customer_id"),
    id_lead: pick(lead, "id") ?? pick(customer, "lead_id"),
    nome_cliente: pick(customer, "name", "company_name", "legal_name"),
    nome_lead: pick(lead, "name"),
    empresa:
      pick(lead, "company") ?? pick(customer, "company_name", "legal_name", "name"),
    email: pick(lead, "email") ?? pick(customer, "email"),
    telefone: pick(lead, "phone") ?? pick(customer, "phone"),
    responsavel:
      str(input.responsavel) ?? pick(lead, "owner_id") ?? pick(customer, "owner_id", "seller_id"),
    status: pick(lead, "stage") ?? pick(customer, "status"),
    origem_lead: pick(lead, "source"),
    ultima_interacao:
      pick(lead, "last_activity_at", "updated_at") ??
      pick(customer, "last_activity_at", "updated_at"),
    // Nunca calculado no banco: responsabilidade do n8n.
    dias_sem_interacao: null,
    data_criacao: pick(lead, "created_at") ?? pick(customer, "created_at"),
    mensagem: str(input.mensagem) ?? pick(lead, "notes") ?? pick(customer, "notes"),
  };

  return { ...contract, ...(input.overrides ?? {}) };
}

/**
 * Garante que as 16 chaves do contrato existam num payload arbitrário,
 * aproveitando equivalências já usadas hoje (cliente_id, lead_id, etc.).
 * Os campos extras do payload original são preservados.
 */
export function ensureNexusContract(
  payload: Record<string, unknown>,
  evento?: string | null,
): Record<string, unknown> {
  const base: NexusContract = {
    evento: str(evento) ?? str(payload["evento"]),
    id_cliente: str(payload["id_cliente"] ?? payload["cliente_id"]),
    id_lead: str(payload["id_lead"] ?? payload["lead_id"]),
    nome_cliente: str(payload["nome_cliente"] ?? payload["cliente_nome"]),
    nome_lead: str(payload["nome_lead"] ?? payload["contato"]),
    empresa: str(payload["empresa"]),
    email: str(payload["email"]),
    telefone: str(payload["telefone"]),
    responsavel: str(payload["responsavel"] ?? payload["responsavel_id"]),
    status: str(payload["status"] ?? payload["novo_status"]),
    origem_lead: str(payload["origem_lead"] ?? payload["origem"]),
    ultima_interacao: str(
      payload["ultima_interacao"] ?? payload["atualizado_em"] ?? payload["alterado_em"],
    ),
    dias_sem_interacao: null,
    data_criacao: str(payload["data_criacao"] ?? payload["criado_em"]),
    mensagem: str(payload["mensagem"] ?? payload["observacoes"] ?? payload["note"]),
  };

  const merged: Record<string, unknown> = { ...base, ...payload };
  // O contrato manda nas 16 chaves: valores nulos do payload não podem apagar
  // o que o mapeador conseguiu resolver.
  for (const key of NEXUS_CONTRACT_KEYS) {
    if (merged[key] === undefined || merged[key] === null || merged[key] === "") {
      merged[key] = base[key];
    }
  }
  merged["dias_sem_interacao"] = null;
  return merged;
}
