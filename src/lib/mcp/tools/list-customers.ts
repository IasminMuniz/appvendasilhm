import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult, jsonResult, requireAuth } from "../result";

export default defineTool({
  name: "list_customers",
  title: "Listar clientes",
  description: "Lista os clientes visíveis para o usuário autenticado, com busca opcional por nome.",
  inputSchema: {
    search: z.string().trim().optional().describe("Filtro parcial pelo nome do cliente."),
    limit: z.number().int().min(1).max(100).optional().describe("Máximo de clientes (padrão 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    const unauth = requireAuth(ctx);
    if (unauth) return unauth;

    let query = supabaseForUser(ctx)
      .from("customers")
      .select("id, name, email, phone, city, state, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);

    if (search) query = query.ilike("name", `%${search}%`);

    const { data, error } = await query;
    return error ? errorResult(error.message) : jsonResult(data ?? []);
  },
});
