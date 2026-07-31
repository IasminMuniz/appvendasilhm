import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult, jsonResult, requireAuth } from "../result";

export default defineTool({
  name: "update_order_status",
  title: "Atualizar status do pedido",
  description: "Atualiza o status de um pedido existente.",
  inputSchema: {
    order_id: z.string().uuid().describe("ID do pedido (use list_orders)."),
    status: z
      .enum(["pendente", "em_andamento", "concluido", "cancelado"])
      .describe("Novo status do pedido."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ order_id, status }, ctx) => {
    const unauth = requireAuth(ctx);
    if (unauth) return unauth;

    const { data, error } = await supabaseForUser(ctx)
      .from("orders")
      .update({ status })
      .eq("id", order_id)
      .select("id, status, total")
      .single();

    return error ? errorResult(error.message) : jsonResult(data);
  },
});
