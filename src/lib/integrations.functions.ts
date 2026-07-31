import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/supabase-auth.middleware";
import { z } from "zod";

export const listIntegrations = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("integrations")
      .select("*")
      .order("category");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertIntegration = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(
    (data: { category: string; provider: string; enabled: boolean; config?: unknown }) =>
      z
        .object({
          category: z.string().min(1).max(60),
          provider: z.string().min(1).max(60),
          enabled: z.boolean(),
          config: z.record(z.string(), z.any()).default({}),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("integrations")
      .select("id")
      .eq("category", data.category)
      .eq("provider", data.provider)
      .maybeSingle();

    const payload = {
      category: data.category,
      provider: data.provider,
      enabled: data.enabled,
      config: data.config,
      status: data.enabled ? "ativo" : "inativo",
      updated_by: context.userId,
    };

    if (existing) {
      const { error } = await context.supabase
        .from("integrations")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("integrations").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
