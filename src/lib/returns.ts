/** Trocas e devoluções das vendas. */
export const RETURN_TYPES = [
  { value: "devolucao", label: "Devolução" },
  { value: "troca", label: "Troca" },
] as const;

export const RETURN_REASONS = [
  "Tamanho não serviu",
  "Defeito na peça",
  "Arrependimento (até 7 dias)",
  "Não gostou do modelo/cor",
  "Diferente do anúncio",
  "Outro",
] as const;

export const returnTypeLabel = (t: string | null | undefined) =>
  t === "troca" ? "Trocada" : t === "devolucao" ? "Devolvida" : null;
