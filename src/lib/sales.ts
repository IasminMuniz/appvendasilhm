/** Regras de venda da loja: canais, taxas, lucro e margem. */
export const CHANNELS = [
  "Shopee",
  "Facebook",
  "Instagram",
  "WhatsApp Business",
  "Indicação (boca a boca)",
  "Venda direta (família e amigos)",
] as const;
export const PAYMENT_METHODS = [
  "Pix",
  "Cartão de crédito",
  "Cartão de débito",
  "Dinheiro",
  "Pago pela Shopee",
] as const;
export const DELIVERY_METHODS = [
  "Shopee",
  "Correios/plataforma de frete",
  "Estação do metrô",
  "Retirada",
] as const;
export const OTHER_COST_TYPES = [
  "Shopee Ads",
  "Ads Fácil",
  "Impulsionamento Facebook/Instagram/Marketplace",
  "Taxa de cartão",
  "Frete/entrega",
  "Outro",
] as const;

/** Custo padrão de embalagem por peça, usado se a configuração da loja não estiver disponível. */
export const DEFAULT_PACKAGING_COST = 1.84;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Taxa da Shopee por faixa de preço unitário da peça. */
export function shopeeFee(price: number): number {
  if (price <= 0) return 0;
  if (price < 80) return round2(price * 0.2 + 4.5);
  if (price < 100) return round2(price * 0.14 + 16);
  if (price < 200) return round2(price * 0.14 + 20);
  return round2(price * 0.14 + 26);
}

export interface SaleItem {
  unit_price: number;
  quantity: number;
}

/** Taxa do canal: na Shopee é cobrada por item (faixa do preço unitário × quantidade). */
export function channelFee(channel: string | null | undefined, items: SaleItem[]): number {
  if (channel !== "Shopee") return 0;
  return round2(
    items.reduce((s, i) => s + shopeeFee(Number(i.unit_price)) * Number(i.quantity), 0),
  );
}

export interface SaleCalc {
  price: number;
  channelFee: number;
  packaging: number;
  /** Valor separado para outros fins (% obrigatório de toda venda, definido no Caixa). */
  reserve: number;
  profit: number;
  margin: number;
}

/** Lucro = preço − taxa − outros custos − custo dos produtos − embalagem (por peça). */
export function calcSale(p: {
  items: SaleItem[];
  channel?: string | null;
  otherCosts: number;
  productCost: number;
  packagingCost?: number;
  /** % do valor da venda separado para outros fins (padrão 0). */
  reservePct?: number;
}): SaleCalc {
  const price = round2(p.items.reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0));
  const pieces = p.items.reduce((s, i) => s + Number(i.quantity), 0);
  const fee = channelFee(p.channel, p.items);
  const packaging = round2((p.packagingCost ?? DEFAULT_PACKAGING_COST) * pieces);
  const reserve = round2((price * (p.reservePct ?? 0)) / 100);
  const profit = round2(price - fee - p.otherCosts - p.productCost - packaging - reserve);
  const margin = price > 0 ? round2((profit / price) * 100) : 0;
  return { price, channelFee: fee, packaging, reserve, profit, margin };
}

export const SALE_STATUSES = [
  { value: "novo", label: "Novo" },
  { value: "reservado", label: "Reservado" },
  { value: "pago", label: "Pago" },
  { value: "entregue", label: "Entregue" },
  { value: "cancelado", label: "Cancelado" },
] as const;

/** Status em que o estoque deve estar baixado. */
/** Toda venda tira a peça do estoque assim que é lançada; só a venda cancelada devolve. */
export const STOCK_OUT_STATUSES = ["novo", "reservado", "pago", "entregue"];
export const takesStock = (status: string | null | undefined) => status !== "cancelado";

/** Código da venda exibido na tela: V-0001, V-0002... */
export const saleCode = (n: number) => `V-${String(n).padStart(4, "0")}`;

/** Lucro e margem a partir dos valores já gravados na venda. */
export function profitOf(o: {
  total: number;
  channelFee: number;
  otherCosts: number;
  productCost: number;
  packaging: number;
  reservePct: number;
}) {
  const reserve = round2((o.total * o.reservePct) / 100);
  const profit = round2(
    o.total - o.channelFee - o.otherCosts - o.productCost - o.packaging - reserve,
  );
  return { profit, margin: o.total > 0 ? round2((profit / o.total) * 100) : 0 };
}

/**
 * Embalagem só conta quando foi marcada na venda (coluna uses_packaging).
 * Enquanto a coluna não existir no banco, vendas feitas até AUTO_PACKAGING_UNTIL
 * (que receberam embalagem automática) contam como sem embalagem.
 */
export const AUTO_PACKAGING_UNTIL = "2026-11-22T23:30:00Z";
export function effectivePackaging(o: {
  packaging_cost?: number | null;
  created_at?: string | null;
  uses_packaging?: boolean | null;
}): number {
  if (typeof o.uses_packaging === "boolean")
    return o.uses_packaging ? Number(o.packaging_cost ?? 0) : 0;
  if (o.created_at && new Date(o.created_at).getTime() < Date.parse(AUTO_PACKAGING_UNTIL)) return 0;
  return Number(o.packaging_cost ?? 0);
}
