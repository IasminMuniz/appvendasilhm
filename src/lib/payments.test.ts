import { describe, expect, it } from "vitest";
import { addMonthsIso, buildInstallments, paymentSummary } from "./payments";

describe("buildInstallments", () => {
  it("à vista e recebido", () => {
    const r = buildInstallments({
      total: 139.9,
      installments: 1,
      firstDate: "2026-11-22",
      firstPaid: true,
      method: "Pix",
    });
    expect(r).toEqual([
      {
        number: 1,
        due_date: "2026-11-22",
        amount: 139.9,
        method: "Pix",
        status: "Pago",
        paid_at: "2026-11-22",
      },
    ]);
  });
  it("3x com centavos na 1ª parcela e datas mensais", () => {
    const r = buildInstallments({
      total: 100,
      installments: 3,
      firstDate: "2026-01-31",
      firstPaid: false,
    });
    expect(r.map((x) => x.amount)).toEqual([33.34, 33.33, 33.33]);
    expect(r.map((x) => x.due_date)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(r.every((x) => x.status === "Pendente")).toBe(true);
  });
  it("addMonthsIso vira o ano", () => {
    expect(addMonthsIso("2026-12-10", 1)).toBe("2027-01-10");
  });
  it("resumo", () => {
    const s = paymentSummary(
      [
        { amount: 50, status: "Pago", due_date: "2026-11-01" },
        { amount: 50, status: "Pendente", due_date: "2026-11-10" },
        { amount: 40, status: "Pendente", due_date: "2026-12-10" },
      ],
      "2026-11-22",
    );
    expect(s).toEqual({
      count: 3,
      paidCount: 1,
      received: 50,
      toReceive: 90,
      overdue: 1,
      nextDue: "2026-11-10",
    });
  });
});
