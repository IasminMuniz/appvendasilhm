import { describe, expect, it } from "vitest";
import { buildAdText } from "./ad-text";

describe("buildAdText", () => {
  it("monta o anúncio no modelo da loja", () => {
    const t = buildAdText({
      name: "Vestido Longo Vermelho",
      style: "Longo",
      color: "Vermelho",
      pattern: "Liso",
      size: "Único",
    });
    expect(t.split("\n")[0]).toBe("Vestido Longo Vermelho");
    expect(t).toContain("• Cor vermelho");
    expect(t).toContain("📏 Tamanho: Único (veste do 36 ao 42)");
    expect(t).toContain("Não aceito dinheiro");
    expect(t).not.toContain("Seminova");
  });
  it("inclui o estado da peça seminova", () => {
    const t = buildAdText({
      name: "Saia",
      size: "M",
      condition: "seminovo",
      condition_notes: "usada 2 vezes",
    });
    expect(t).toContain("♻️");
    expect(t).toContain("• Estado: usada 2 vezes");
    expect(t).toContain("📏 Tamanho: M");
  });
});
