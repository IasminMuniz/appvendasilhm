import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult, jsonResult, requireAuth } from "../result";

export default defineTool({
  name: "sales_summary",
  title: "Resumo de vendas",
  description: "Retorna um resumo dos pedidos: contagem por status e valor total.",
  inputSchema: {
    since: z.string().trim().optional().describe("Data ISO inicial, ex. 2026-01-01."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ since }, ctx) => {
    const unauth = requireAuth(ctx);
    if (unauth) return unauth;

    let query = supabaseForUser(ctx).from("orders").select("status, total, created_at");
    if (since) query = query.gte("created_at", since);

    const { data, error } = await query;
    if (error) return errorResult(error.message);

    const rows = data ?? [];
    const byStatus: Record<string, { count: number; total: number }> = {};
    let total = 0;

    for (const row of rows) {
      const status = row.status ?? "pendente";
      const value = Number(row.total ?? 0);
      byStatus[status] ??= { count: 0, total: 0 };
      byStatus[status].count += 1;
      byStatus[status].total += value;
      total += value;
    }

    return jsonResult({ orders: rows.length, total_value: total, by_status: byStatus });
  },
});
