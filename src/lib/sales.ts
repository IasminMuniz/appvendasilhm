/** Regras de venda da loja: canais, taxas, lucro e margem. */
export const CHANNELS = ["Shopee", "Facebook", "Instagram", "WhatsApp Business"] as const;
export const PAYMENT_METHODS = ["Pix", "Cartão"] as const;
export const DELIVERY_METHODS = ["Shopee", "Correios/plataforma de frete", "Estação do metrô", "Retirada"] as const;
export const OTHER_COST_TYPES = [
  "Shopee Ads",
  "Ads Fácil",
  "Impulsionamento Facebook/Instagram/Marketplace",
  "Taxa de cartão",
  "Frete/entrega",
  "Outro",
] as const;

export const PACKAGING_COST = 1.84;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Taxa da Shopee por faixa de valor da venda. */
export function shopeeFee(price: number): number {
  if (price <= 0) return 0;
  if (price < 80) return round2(price * 0.2 + 4.5);
  if (price < 100) return round2(price * 0.14 + 16);
  if (price < 200) return round2(price * 0.14 + 20);
  return round2(price * 0.14 + 26);
}

export function channelFee(channel: string | null | undefined, price: number): number {
  return channel === "Shopee" ? shopeeFee(price) : 0;
}

export interface SaleCalc {
  channelFee: number;
  profit: number;
  margin: number;
}

/** Lucro = preço − taxa − outros custos − custo dos produtos − embalagem. */
export function calcSale(p: { price: number; channel?: string | null; otherCosts: number; productCost: number }): SaleCalc {
  const fee = channelFee(p.channel, p.price);
  const profit = round2(p.price - fee - p.otherCosts - p.productCost - PACKAGING_COST);
  const margin = p.price > 0 ? round2((profit / p.price) * 100) : 0;
  return { channelFee: fee, profit, margin };
}

export const SALE_STATUSES = [
  { value: "novo", label: "Novo" },
  { value: "reservado", label: "Reservado" },
  { value: "pago", label: "Pago" },
  { value: "entregue", label: "Entregue" },
  { value: "cancelado", label: "Cancelado" },
] as const;

/** Status em que o estoque deve estar baixado. */
export const STOCK_OUT_STATUSES = ["pago", "entregue"];
