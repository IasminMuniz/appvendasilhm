export const LEAD_STAGES = [
  { value: "novo", label: "Novo Lead" },
  { value: "contato_realizado", label: "Contato Realizado" },
  { value: "qualificado", label: "Qualificado" },
  { value: "oportunidade", label: "Oportunidade" },
  { value: "proposta_enviada", label: "Proposta Enviada" },
  { value: "negociacao", label: "Negociação" },
  { value: "ganho", label: "Fechado Ganho" },
  { value: "perdido", label: "Fechado Perdido" },
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number]["value"];

export const ORDER_STATUSES = [
  { value: "criado", label: "Criado" },
  { value: "aguardando_aprovacao", label: "Aguardando aprovação" },
  { value: "aprovado", label: "Aprovado" },
  { value: "processamento", label: "Processamento" },
  { value: "faturado", label: "Faturado" },
  { value: "finalizado", label: "Finalizado" },
  { value: "cancelado", label: "Cancelado" },
] as const;

export const LEGACY_ORDER_LABELS: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluído",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  ...Object.fromEntries(ORDER_STATUSES.map((s) => [s.value, s.label])),
  ...LEGACY_ORDER_LABELS,
};

/** Fluxo linear de avanço do pedido. */
export const ORDER_FLOW = [
  "criado",
  "aguardando_aprovacao",
  "aprovado",
  "processamento",
  "faturado",
  "finalizado",
] as const;

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando_aprovacao: "Enviado para aprovação",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
  convertido: "Convertido em pedido",
};

export const HEALTH_LABELS: Record<string, string> = {
  saudavel: "Saudável",
  atencao: "Atenção",
  risco: "Risco",
  inativo: "Sem compras",
};

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}
