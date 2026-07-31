import type { ToolContext } from "@lovable.dev/mcp-js";

export function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export function jsonResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: { result: value } as Record<string, unknown>,
  };
}

export function requireAuth(ctx: ToolContext) {
  return ctx.isAuthenticated() ? null : errorResult("Não autenticado. Conecte-se ao app primeiro.");
}
