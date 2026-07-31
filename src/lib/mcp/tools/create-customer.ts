import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult, jsonResult, requireAuth } from "../result";

export default defineTool({
  name: "create_customer",
  title: "Criar cliente",
  description: "Cadastra um novo cliente vinculado ao usuário autenticado.",
  inputSchema: {
    name: z.string().trim().min(1).describe("Nome do cliente."),
    email: z.string().trim().optional().describe("E-mail do cliente."),
    phone: z.string().trim().optional().describe("Telefone do cliente."),
    city: z.string().trim().optional().describe("Cidade."),
    state: z.string().trim().optional().describe("Estado (UF)."),
    notes: z.string().trim().optional().describe("Observações internas."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const unauth = requireAuth(ctx);
    if (unauth) return unauth;

    const { data, error } = await supabaseForUser(ctx)
      .from("customers")
      .insert({
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        notes: input.notes ?? null,
        seller_id: ctx.getUserId(),
      })
      .select("id, name, email, phone, city, state")
      .single();

    return error ? errorResult(error.message) : jsonResult(data);
  },
});
