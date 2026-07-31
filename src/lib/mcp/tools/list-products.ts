import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult, jsonResult, requireAuth } from "../result";

export default defineTool({
  name: "list_products",
  title: "Listar produtos",
  description: "Lista os produtos do catálogo, opcionalmente apenas os ativos.",
  inputSchema: {
    only_active: z.boolean().optional().describe("Se verdadeiro, retorna apenas produtos ativos."),
    search: z.string().trim().optional().describe("Filtro parcial pelo nome do produto."),
    limit: z.number().int().min(1).max(100).optional().describe("Máximo de produtos (padrão 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ only_active, search, limit }, ctx) => {
    const unauth = requireAuth(ctx);
    if (unauth) return unauth;

    let query = supabaseForUser(ctx)
      .from("products")
      .select("id, name, description, price, active")
      .order("name")
      .limit(limit ?? 50);

    if (only_active) query = query.eq("active", true);
    if (search) query = query.ilike("name", `%${search}%`);

    const { data, error } = await query;
    return error ? errorResult(error.message) : jsonResult(data ?? []);
  },
});
