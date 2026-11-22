import { describe, expect, it } from "vitest";
import { calcSale, shopeeFee } from "./sales";

describe("shopeeFee", () => {
  it("abaixo de 80: 20% + 4,50", () => expect(shopeeFee(50)).toBe(14.5));
  it("80 a 99,99: 14% + 16", () => expect(shopeeFee(90)).toBe(28.6));
  it("100 a 199,99: 14% + 20", () => expect(shopeeFee(150)).toBe(41));
  it("200 a 499,99: 14% + 26", () => expect(shopeeFee(300)).toBe(68));
  it("500 ou mais: 14% + 26", () => expect(shopeeFee(600)).toBe(110));
});

describe("calcSale", () => {
  it("lucro Shopee desconta taxa, custos e embalagem 1,84", () => {
    const r = calcSale({ price: 150, channel: "Shopee", otherCosts: 10, productCost: 50 });
    expect(r.channelFee).toBe(41);
    expect(r.profit).toBe(47.16);
    expect(r.margin).toBe(31.44);
  });
  it("outros canais têm taxa 0", () => {
    const r = calcSale({ price: 100, channel: "Instagram", otherCosts: 0, productCost: 40 });
    expect(r.channelFee).toBe(0);
    expect(r.profit).toBe(58.16);
  });
});
