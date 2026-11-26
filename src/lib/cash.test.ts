import { describe, expect, it } from "vitest";
import { DEFAULT_CASH_PLAN, normalizePlan, splitSales } from "./cash";

describe("splitSales", () => {
  it("divide uma venda de R$ 120 no Facebook (custo 63, embalagem 1,84)", () => {
    const r = splitSales(
      [{ total: 120, channel_fee: 0, other_costs: 0, product_cost: 63, packaging_cost: 1.84 }],
      { ...DEFAULT_CASH_PLAN, taxPerSale: 0 },
    );
    expect(r.profit).toBe(55.16);
    expect(r.otherPurposes).toBe(12); // 10% de 120
    expect(r.reserve).toBe(8.63); // 20% de 43,16
    expect(r.growth).toBe(12.95); // 30% de 43,16
    expect(r.ownerProfit).toBe(21.58);
    // tudo somado volta ao valor da venda
    const total =
      r.fees + r.restock + r.packaging + r.otherPurposes + r.reserve + r.growth + r.ownerProfit;
    expect(Math.round(total * 100) / 100).toBe(120);
  });
});

describe("splitSales com DAS", () => {
  it("venda de R$ 129,90 no Pix: custo 75, embalagem 3, DAS 8, 10% outros fins", () => {
    const r = splitSales(
      [{ total: 129.9, channel_fee: 0, other_costs: 0, product_cost: 75, packaging_cost: 3 }],
      { initialCapital: 0, otherPurposesPct: 10, taxPerSale: 8, reservePct: 20, growthPct: 30 },
    );
    expect(r.tax).toBe(8);
    expect(r.profit).toBe(43.9);
    expect(r.otherPurposes).toBe(12.99);
    const total =
      r.fees +
      r.restock +
      r.packaging +
      r.tax +
      r.otherPurposes +
      r.reserve +
      r.growth +
      r.ownerProfit;
    expect(Math.round(total * 100) / 100).toBe(129.9);
  });
});

describe("normalizePlan", () => {
  it("usa o padrão quando não há plano salvo", () => {
    expect(normalizePlan(null)).toEqual(DEFAULT_CASH_PLAN);
  });
});
