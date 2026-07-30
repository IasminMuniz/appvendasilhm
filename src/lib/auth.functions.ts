import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getCurrentUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .single();

    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    return {
      id: context.userId,
      email: context.claims.email ?? profile?.email ?? null,
      fullName: profile?.full_name ?? null,
      roles: roles?.map((r) => r.role) ?? [],
      isAdmin: roles?.some((r) => r.role === "admin") ?? false,
    };
  });
