import { describe, expect, it } from "vitest";
import { buildSku, calcMargin } from "./clothing";

describe("buildSku", () => {
  it("monta o exemplo VE-F01-CM-BR-B01-U", () => {
    expect(buildSku({ supplier: "PML Fashion", style: "Camadas/Babados", color: "Branco", pattern: "Bordado", model_number: 1, size: "Único" })).toBe("VE-F01-CM-BR-B01-U");
  });
  it("usa tamanho numérico como está", () => {
    expect(buildSku({ supplier: "PML Fashion", style: "Midi", color: "Preto", pattern: "Liso", model_number: 12, size: "38" })).toBe("VE-F01-MD-PT-L12-38");
  });
  it("retorna null se faltar campo", () => {
    expect(buildSku({ supplier: "PML Fashion", style: "Midi", color: "Preto", pattern: "Liso", size: "M" })).toBeNull();
  });
});

describe("calcMargin", () => {
  it("calcula margem sobre o preço", () => {
    expect(calcMargin(200, 80)).toBe(60);
  });
  it("preço zero dá margem zero", () => {
    expect(calcMargin(0, 50)).toBe(0);
  });
});
