export const LEAD_STAGES = [
  { value: "novo", label: "Novo Lead" },
  { value: "contato_realizado", label: "Contato Realizado" },
  { value: "qualificado", label: "Qualificado" },
  { value: "reuniao", label: "Reunião" },
  { value: "proposta_enviada", label: "Proposta Enviada" },
  { value: "negociacao", label: "Negociação" },
  { value: "ganho", label: "Fechado Ganho" },
  { value: "convertido", label: "Convertido em Cliente" },
  { value: "perdido", label: "Fechado Perdido" },
] as const;

/** Etapas antigas ainda existentes no banco. */
export const LEGACY_LEAD_STAGE_LABELS: Record<string, string> = {
  oportunidade: "Oportunidade",
};

export const LEAD_STAGE_LABELS: Record<string, string> = {
  ...Object.fromEntries(LEAD_STAGES.map((s) => [s.value, s.label])),
  ...LEGACY_LEAD_STAGE_LABELS,
};

/** Probabilidade automática por etapa (o usuário não preenche manualmente). */
export const STAGE_PROBABILITY: Record<string, number> = {
  novo: 10,
  contato_realizado: 20,
  qualificado: 40,
  reuniao: 60,
  oportunidade: 60,
  proposta_enviada: 75,
  negociacao: 90,
  ganho: 100,
  convertido: 100,
  perdido: 0,
};

/** Dias somados à data atual para previsão automática de fechamento. */
export const STAGE_FORECAST_DAYS: Record<string, number> = {
  novo: 30,
  qualificado: 20,
  proposta_enviada: 15,
  negociacao: 7,
};

export const CUSTOMER_STATUSES = [
  { value: "prospect", label: "Prospect" },
  { value: "ativo", label: "Cliente ativo" },
  { value: "inativo", label: "Cliente inativo" },
  { value: "perdido", label: "Cliente perdido" },
] as const;

export const CUSTOMER_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  CUSTOMER_STATUSES.map((s) => [s.value, s.label]),
);

export const OPPORTUNITY_STATUSES = [
  { value: "aberta", label: "Aberta" },
  { value: "em_negociacao", label: "Em negociação" },
  { value: "ganha", label: "Ganha" },
  { value: "perdida", label: "Perdida" },
] as const;

export const OPPORTUNITY_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  OPPORTUNITY_STATUSES.map((s) => [s.value, s.label]),
);

export const OPPORTUNITY_PROBABILITY: Record<string, number> = {
  aberta: 30,
  em_negociacao: 70,
  ganha: 100,
  perdida: 0,
};

export const PRODUCT_CATEGORIES = [
  "Equipamentos",
  "Insumos",
  "Serviços",
  "Software",
  "Manutenção",
  "Outro",
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number]["value"];


export const ORDER_STATUSES = [
  { value: "novo", label: "Novo" },
  { value: "processamento", label: "Processando" },
  { value: "faturado", label: "Faturado" },
  { value: "entregue", label: "Entregue" },
  { value: "cancelado", label: "Cancelado" },
] as const;

export const LEGACY_ORDER_LABELS: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  criado: "Criado",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovado: "Aprovado",
  finalizado: "Finalizado",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  ...LEGACY_ORDER_LABELS,
  ...Object.fromEntries(ORDER_STATUSES.map((s) => [s.value, s.label])),
};

/** Fluxo linear de avanço do pedido. */
export const ORDER_FLOW = ["novo", "processamento", "faturado", "entregue"] as const;

/** Status que representam venda concluída (contam como receita realizada). */
export const ORDER_DONE_STATUSES = ["entregue", "faturado", "finalizado", "concluido"];

export const QUOTE_STATUSES = [
  { value: "rascunho", label: "Criado" },
  { value: "enviado", label: "Enviado" },
  { value: "aprovado", label: "Aprovado" },
  { value: "recusado", label: "Recusado" },
] as const;

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  rascunho: "Criado",
  enviado: "Enviado",
  aguardando_aprovacao: "Enviado para aprovação",
  aprovado: "Aprovado",
  reprovado: "Recusado",
  recusado: "Recusado",
  convertido: "Convertido em pedido",
};


export const HEALTH_LABELS: Record<string, string> = {
  saudavel: "Saudável",
  atencao: "Atenção",
  risco: "Risco",
  inativo: "Sem compras",
};

export const CUSTOMER_SEGMENTS = [
  "Indústria",
  "Distribuição",
  "Varejo",
  "Serviços",
  "Governo",
  "Outro",
] as const;

export const COMPANY_SIZES = ["Micro", "Pequeno", "Médio", "Grande"] as const;

export const LOSS_REASONS = [
  "Preço",
  "Prazo de entrega",
  "Concorrência",
  "Sem orçamento",
  "Sem resposta",
  "Escopo não atendido",
  "Outro",
] as const;

export const NEXT_ACTION_STATUSES = [
  { value: "pendente", label: "Pendente" },
  { value: "concluida", label: "Concluída" },
  { value: "cancelada", label: "Cancelada" },
] as const;

export const INTERACTION_KINDS = [
  "nota",
  "ligacao",
  "reuniao",
  "email",
  "whatsapp",
  "visita",
] as const;

export const INTERACTION_LABELS: Record<string, string> = {
  nota: "Observação",
  ligacao: "Ligação",
  reuniao: "Reunião",
  email: "E-mail",
  whatsapp: "WhatsApp",
  visita: "Visita",
};


export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR");
}

/** Rótulos dos eventos internos do Nexus 360 (uso na interface). */
export const NEXUS_EVENT_LABELS: Record<string, string> = {
  CLIENTE_CRIADO: "Cliente criado",
  CLIENTE_ATUALIZADO: "Cliente atualizado",
  CLIENTE_INATIVO: "Cliente inativo",
  LEAD_CRIADO: "Lead criado",
  LEAD_ATUALIZADO: "Lead atualizado",
  LEAD_STATUS_ALTERADO: "Status do lead alterado",
  OPORTUNIDADE_CRIADA: "Oportunidade criada",
  OPORTUNIDADE_STATUS_ALTERADO: "Status da oportunidade alterado",
  PEDIDO_STATUS_ALTERADO: "Status do pedido alterado",
  VENDA_FECHADA: "Venda fechada",
};

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  gerente: "Gestor comercial",
  supervisor: "Supervisor",
  vendedor: "Vendedor",
};


/** Etapas que o usuário não pode selecionar manualmente (definidas pelo sistema). */
export const SYSTEM_LEAD_STAGES = ["convertido"] as const;

/** Unidades federativas do Brasil para os campos de localização. */
export const BRAZIL_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR",
  "PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;

/* ------------------------------------------------------------------ */
/* Integrações (módulo que reutiliza a estrutura de produtos)          */
/* ------------------------------------------------------------------ */

export const INTEGRATION_SYSTEMS = [
  "Salesforce",
  "HubSpot",
  "RD Station",
  "SAP",
  "TOTVS",
  "Zendesk",
  "n8n",
  "Outro",
] as const;

export const INTEGRATION_CATEGORIES = [
  "CRM",
  "ERP",
  "Marketing",
  "Atendimento",
  "Automação",
  "BI",
] as const;

export const INTEGRATION_CONNECTION_STATUSES = [
  { value: "conectado", label: "Conectado" },
  { value: "pendente", label: "Pendente" },
  { value: "erro", label: "Erro de conexão" },
  { value: "desconectado", label: "Desconectado" },
] as const;

export const INTEGRATION_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  INTEGRATION_CONNECTION_STATUSES.map((s) => [s.value, s.label]),
);

export function integrationStatusVariant(status?: string | null) {
  if (status === "conectado") return "default" as const;
  if (status === "erro") return "destructive" as const;
  return "secondary" as const;
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR");
}

/* ------------------------------------------------------------------ */
/* Automações (módulo que reutiliza a estrutura de eventos internos)   */
/* ------------------------------------------------------------------ */

/** Sistema de origem apresentado a partir da entidade do evento. */
export const AUTOMATION_SOURCE_BY_ENTITY: Record<string, string> = {
  lead: "Nexus 360 · Leads",
  customer: "Nexus 360 · Clientes",
  cliente: "Nexus 360 · Clientes",
  opportunity: "Nexus 360 · Oportunidades",
  oportunidade: "Nexus 360 · Oportunidades",
  order: "Nexus 360 · Pedidos",
  pedido: "Nexus 360 · Pedidos",
  quote: "Nexus 360 · Orçamentos",
  orcamento: "Nexus 360 · Orçamentos",
};

/** Sistema de destino apresentado a partir do evento inicial. */
export const AUTOMATION_TARGET_BY_EVENT: Record<string, string> = {
  LEAD_CRIADO: "n8n · E-mail + PostgreSQL",
  LEAD_STATUS_ALTERADO: "n8n · E-mail + PostgreSQL",
  LEAD_ATUALIZADO: "n8n · PostgreSQL",
  CLIENTE_CRIADO: "n8n · CRM",
  CLIENTE_ATUALIZADO: "n8n · CRM",
  CLIENTE_INATIVO: "n8n · E-mail",
  OPORTUNIDADE_CRIADA: "n8n · CRM",
  OPORTUNIDADE_STATUS_ALTERADO: "n8n · CRM",
  PEDIDO_STATUS_ALTERADO: "n8n · ERP",
  VENDA_FECHADA: "n8n · ERP + BI",
};

export function automationSource(entityType?: string | null): string {
  return AUTOMATION_SOURCE_BY_ENTITY[entityType ?? ""] ?? "Nexus 360";
}

export function automationTarget(eventType?: string | null): string {
  return AUTOMATION_TARGET_BY_EVENT[eventType ?? ""] ?? "n8n";
}

export function automationName(eventType?: string | null, entityType?: string | null): string {
  const label = NEXUS_EVENT_LABELS[eventType ?? ""] ?? eventType ?? "Fluxo";
  const source = automationSource(entityType).replace("Nexus 360 · ", "");
  return `${source}: ${label}`;
}

/** Status de execução da automação a partir do status de entrega do evento. */
export function automationStatus(status?: string | null): { label: string; variant: "default" | "destructive" | "secondary" } {
  if (status === "entregue") return { label: "Executada", variant: "default" };
  if (status === "erro") return { label: "Falha na execução", variant: "destructive" };
  return { label: "Aguardando execução", variant: "secondary" };
}
