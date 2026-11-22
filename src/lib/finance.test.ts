import { describe, expect, it } from "vitest";
import { addMonths } from "./finance.functions";

describe("addMonths", () => {
  it("mantém o dia nos meses seguintes", () => {
    expect(addMonths("2026-12-20", 1)).toBe("2027-01-20");
    expect(addMonths("2026-12-20", 12)).toBe("2027-12-20");
  });
  it("ajusta para o último dia quando o mês é mais curto", () => {
    expect(addMonths("2027-01-31", 1)).toBe("2027-02-28");
  });
});
