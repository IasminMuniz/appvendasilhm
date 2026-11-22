/** Catálogo de códigos da loja de roupas e regras de SKU/margem. */
export const SUPPLIERS = [{ value: "PML Fashion", code: "F01" }] as const;

export const STYLES = [
  { value: "Mini/Curto", code: "MI" },
  { value: "Midi", code: "MD" },
  { value: "Longo", code: "LG" },
  { value: "Camadas/Babados", code: "CM" },
  { value: "Tubinho", code: "TB" },
  { value: "Chemise", code: "CH" },
  { value: "Envelope", code: "EV" },
  { value: "Tomara que caia", code: "TQ" },
  { value: "Ombro a ombro", code: "OB" },
] as const;

export const COLORS = [
  { value: "Branco", code: "BR" },
  { value: "Off-white", code: "OF" },
  { value: "Preto", code: "PT" },
  { value: "Bege", code: "BG" },
  { value: "Rosa", code: "RS" },
  { value: "Lilás", code: "LL" },
  { value: "Azul", code: "AZ" },
  { value: "Verde", code: "VD" },
  { value: "Vermelho", code: "VM" },
  { value: "Amarelo", code: "AM" },
  { value: "Marrom", code: "MR" },
  { value: "Multicolor", code: "MC" },
] as const;

export const PATTERNS = [
  { value: "Liso", code: "L" },
  { value: "Estampado", code: "E" },
  { value: "Bordado", code: "B" },
] as const;

export const SIZES = [
  "Único", "PP", "P", "M", "G", "GG", "XG", "G1", "G2", "G3",
  "34", "36", "38", "40", "42", "44", "46", "48",
] as const;

type Coded = readonly { value: string; code: string }[];
const codeOf = (list: Coded, v?: string | null) => list.find((i) => i.value === v)?.code;

export interface SkuInput {
  supplier?: string | null;
  style?: string | null;
  color?: string | null;
  pattern?: string | null;
  model_number?: number | null;
  size?: string | null;
}

/** VE-[fornecedor]-[estilo]-[cor]-[padrão][modelo 2 dígitos]-[tamanho]; null se incompleto. */
export function buildSku(i: SkuInput): string | null {
  const s = codeOf(SUPPLIERS, i.supplier);
  const st = codeOf(STYLES, i.style);
  const c = codeOf(COLORS, i.color);
  const p = codeOf(PATTERNS, i.pattern);
  const m = i.model_number;
  if (!s || !st || !c || !p || !i.size || m == null || !Number.isInteger(m) || m < 0) return null;
  const size = i.size === "Único" ? "U" : i.size;
  return `VE-${s}-${st}-${c}-${p}${String(m).padStart(2, "0")}-${size}`;
}

/** Margem sobre o preço de venda, em %, arredondada a 2 casas. */
export function calcMargin(price: number, cost: number): number {
  if (!price || price <= 0) return 0;
  return Math.round(((price - cost) / price) * 10000) / 100;
}
