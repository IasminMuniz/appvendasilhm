/** Estoque = entradas (compras recebidas) − saídas (vendas não canceladas). */

export interface StockMove {
  product_id: string | null;
  quantity: number;
  /** Status da compra (Recebido conta) ou da venda (cancelado não conta). */
  status: string | null | undefined;
  kind: "in" | "out";
}

export interface StockCount {
  entradas: number;
  saidas: number;
  estoque: number;
}

export function countStock(moves: StockMove[]): Map<string, StockCount> {
  const map = new Map<string, StockCount>();
  for (const m of moves) {
    if (!m.product_id) continue;
    const c = map.get(m.product_id) ?? { entradas: 0, saidas: 0, estoque: 0 };
    const q = Number(m.quantity) || 0;
    if (m.kind === "in" && m.status === "Recebido") c.entradas += q;
    if (m.kind === "out" && m.status !== "cancelado") c.saidas += q;
    map.set(m.product_id, c);
  }
  for (const c of map.values()) c.estoque = Math.max(0, c.entradas - c.saidas);
  return map;
}
