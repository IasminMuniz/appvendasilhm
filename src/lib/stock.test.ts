import { describe, expect, it } from "vitest";
import { countStock } from "./stock";

describe("countStock", () => {
  it("comprou 2, vendeu 1 → estoque 1; cancelada e compra pedida não contam", () => {
    const r = countStock([
      { product_id: "a", quantity: 2, status: "Recebido", kind: "in" },
      { product_id: "a", quantity: 3, status: "Pedido", kind: "in" },
      { product_id: "a", quantity: 1, status: "entregue", kind: "out" },
      { product_id: "a", quantity: 1, status: "cancelado", kind: "out" },
    ]);
    expect(r.get("a")).toEqual({ entradas: 2, saidas: 1, estoque: 1 });
  });
});
