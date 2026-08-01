export const LEAD_STAGES = [
  { value: "novo", label: "Novo Lead" },
  { value: "contato_realizado", label: "Contato Realizado" },
  { value: "qualificado", label: "Qualificado" },
  { value: "reuniao", label: "Reunião" },
  { value: "proposta_enviada", label: "Proposta Enviada" },
  { value: "negociacao", label: "Negociação" },
  { value: "ganho", label: "Fechado Ganho" },
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

export const INTERACTION_KINDS = ["nota", "ligacao", "reuniao", "email", "visita"] as const;

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR");
}
