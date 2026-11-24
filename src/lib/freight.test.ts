import { describe, it, expect } from "vitest";
import { parseQuotes } from "./freight";

describe("parseQuotes", () => {
  it("descarta itens com erro e ordena pelo menor preço", () => {
    const r = parseQuotes([
      { name: "SEDEX", custom_price: "30.50", custom_delivery_time: 2, company: { name: "Correios" } },
      { name: "Mini", error: "Indisponível", company: { name: "Correios" } },
      { name: "PAC", custom_price: "18.20", custom_delivery_time: 6, company: { name: "Correios" } },
    ]);
    expect(r.map((q) => q.servico)).toEqual(["PAC", "SEDEX"]);
    expect(r[0]?.preco).toBe(18.2);
  });
});
