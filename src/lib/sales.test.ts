import { describe, expect, it } from "vitest";
import { calcSale, channelFee, normalizePackagingItems, shopeeFee } from "./sales";

describe("shopeeFee", () => {
  it("abaixo de 80: 20% + 4,50", () => expect(shopeeFee(50)).toBe(14.5));
  it("80 a 99,99: 14% + 16", () => expect(shopeeFee(90)).toBe(28.6));
  it("100 a 199,99: 14% + 20", () => expect(shopeeFee(150)).toBe(41));
  it("200 a 499,99: 14% + 26", () => expect(shopeeFee(300)).toBe(68));
  it("500 ou mais: 14% + 26", () => expect(shopeeFee(600)).toBe(110));
});

describe("channelFee", () => {
  it("Shopee cobra por item, pelo preço unitário", () => {
    // 2 vestidos de 139,90: 2 × (14% × 139,90 + 20 = 39,59) = 79,18
    expect(channelFee("Shopee", [{ unit_price: 139.9, quantity: 2 }])).toBe(79.18);
  });
  it("outros canais não têm taxa", () => {
    expect(channelFee("Facebook", [{ unit_price: 139.9, quantity: 2 }])).toBe(0);
  });
});

describe("calcSale", () => {
  it("lucro Shopee desconta taxa, custos e embalagem 1,84", () => {
    const r = calcSale({
      items: [{ unit_price: 150, quantity: 1 }],
      channel: "Shopee",
      otherCosts: 10,
      productCost: 50,
    });
    expect(r.channelFee).toBe(41);
    expect(r.profit).toBe(47.16);
    expect(r.margin).toBe(31.44);
  });
  it("embalagem é por peça e usa o valor configurado", () => {
    const r = calcSale({
      items: [{ unit_price: 100, quantity: 2 }],
      channel: "Instagram",
      otherCosts: 0,
      productCost: 80,
      packagingCost: 2,
    });
    expect(r.packaging).toBe(4);
    expect(r.profit).toBe(116);
  });
});

describe("calcSale com % para outros fins", () => {
  it("desconta 10% do valor da venda", () => {
    const r = calcSale({
      items: [{ unit_price: 129.9, quantity: 1 }],
      channel: "Venda direta (família e amigos)",
      otherCosts: 0,
      productCost: 73,
      packagingCost: 0,
      reservePct: 10,
    });
    expect(r.reserve).toBe(12.99);
    expect(r.profit).toBe(43.91);
  });
});

describe("normalizePackagingItems", () => {
  it("mantém as três sacolas e usa os valores salvos", () => {
    const r = normalizePackagingItems([
      { id: "sacola_rosa", price: 0.5 },
      { id: "x", price: 9 },
    ]);
    expect(r.map((i) => i.id)).toEqual(["sacola_transparente", "sacola_rosa", "sacola_postagem"]);
    expect(r.find((i) => i.id === "sacola_rosa")?.price).toBe(0.5);
    expect(normalizePackagingItems(null).every((i) => i.price === 0)).toBe(true);
  });
});
