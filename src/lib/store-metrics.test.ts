import { describe, expect, it } from "vitest";
import { breakEven } from "./store-metrics";

describe("breakEven", () => {
  it("falta lucro = despesas fixas − lucro, convertido pela margem média", () => {
    const r = breakEven({ fixedExpenses: 1000, profit: 400, revenue: 1000 });
    expect(r.missingProfit).toBe(600);
    expect(r.missingRevenue).toBe(1500);
    expect(r.covered).toBe(false);
  });
  it("lucro acima das despesas fixas = coberto", () => {
    const r = breakEven({ fixedExpenses: 500, profit: 800, revenue: 2000 });
    expect(r.missingProfit).toBe(0);
    expect(r.covered).toBe(true);
  });
});
