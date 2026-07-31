import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult, jsonResult, requireAuth } from "../result";

export default defineTool({
  name: "list_orders",
  title: "Listar pedidos",
  description: "Lista pedidos com cliente e itens, com filtro opcional por status.",
  inputSchema: {
    status: z
      .enum(["pendente", "em_andamento", "concluido", "cancelado"])
      .optional()
      .describe("Filtra pedidos por status."),
    limit: z.number().int().min(1).max(100).optional().describe("Máximo de pedidos (padrão 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    const unauth = requireAuth(ctx);
    if (unauth) return unauth;

    let query = supabaseForUser(ctx)
      .from("orders")
      .select("id, status, total, notes, created_at, customers(name), order_items(quantity, unit_price, total, products(name))")
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    return error ? errorResult(error.message) : jsonResult(data ?? []);
  },
});
