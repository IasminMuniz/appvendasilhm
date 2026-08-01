import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/supabase-auth.middleware";
import { z } from "zod";

const roleSchema = z.enum(["admin", "gerente", "supervisor", "vendedor"]);

/** Garante que o usuário autenticado é administrador. */
async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Acesso negado: apenas administradores podem executar esta ação.");
}

/** Perfil de acesso + responsável comercial do usuário autenticado. */
export const getAccessProfile = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const [{ data: profile }, { data: roles }] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("id, full_name, email, supervisor_id")
        .eq("id", context.userId)
        .maybeSingle(),
      context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
    ]);
    const list = (roles ?? []).map((r: { role: string }) => r.role);
    return {
      id: context.userId,
      fullName: profile?.full_name ?? null,
      email: profile?.email ?? context.claims.email ?? null,
      supervisorId: profile?.supervisor_id ?? null,
      roles: list,
      isAdmin: list.includes("admin"),
      isLeader: list.includes("admin") || list.includes("gerente") || list.includes("supervisor"),
      isSeller: list.includes("vendedor"),
    };
  });

/**
 * Usuários visíveis para o usuário autenticado (RLS aplica a hierarquia:
 * admin vê todos, gestor/supervisor vê a equipe, vendedor vê apenas a si).
 */
export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const [{ data: profiles, error }, { data: roles }] = await Promise.all([
      context.supabase.from("profiles").select("id, full_name, email, supervisor_id").order("full_name"),
      context.supabase.from("user_roles").select("user_id, role"),
    ]);
    if (error) throw new Error(error.message);

    const roleMap = new Map<string, string[]>();
    for (const r of roles ?? []) {
      roleMap.set(r.user_id, [...(roleMap.get(r.user_id) ?? []), r.role]);
    }
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email || "Usuário"]));

    return (profiles ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      supervisor_id: p.supervisor_id,
      supervisor_name: p.supervisor_id ? nameMap.get(p.supervisor_id) ?? null : null,
      roles: roleMap.get(p.id) ?? [],
    }));
  });

/** Define o perfil de acesso de um usuário (somente administrador). */
export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { user_id: string; role: string }) =>
    z.object({ user_id: z.string().uuid(), role: roleSchema }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.user_id === context.userId && data.role !== "admin") {
      throw new Error("Você não pode remover o seu próprio acesso de administrador.");
    }
    const { error: delError } = await context.supabase
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id);
    if (delError) throw new Error(delError.message);

    const { error } = await context.supabase
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Vincula um usuário ao seu responsável comercial (somente administrador). */
export const setUserSupervisor = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { user_id: string; supervisor_id?: string }) =>
    z
      .object({
        user_id: z.string().uuid(),
        supervisor_id: z.string().uuid().optional().or(z.literal("")),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.supervisor_id && data.supervisor_id === data.user_id) {
      throw new Error("Um usuário não pode ser responsável por si mesmo.");
    }
    const { error } = await context.supabase
      .from("profiles")
      .update({ supervisor_id: data.supervisor_id || null })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Cria um usuário já com perfil de acesso e responsável comercial (admin). */
export const createUser = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(
    (data: {
      email: string;
      password: string;
      full_name: string;
      role: string;
      supervisor_id?: string;
    }) =>
      z
        .object({
          email: z.string().email("E-mail inválido"),
          password: z.string().min(8, "Mínimo de 8 caracteres"),
          full_name: z.string().min(1, "Informe o nome").max(160),
          role: roleSchema,
          supervisor_id: z.string().uuid().optional().or(z.literal("")),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar usuário.");

    const userId = created.user.id;
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: data.role });
    await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.full_name, supervisor_id: data.supervisor_id || null })
      .eq("id", userId);

    return { id: userId };
  });

/** Histórico de eventos internos, respeitando a hierarquia do usuário. */
export const listEvents = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data?: { eventType?: string; limit?: number }) =>
    z
      .object({ eventType: z.string().max(60).optional(), limit: z.number().min(1).max(200).default(100) })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("commercial_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.eventType) query = query.eq("event_type", data.eventType);

    const [{ data: events, error }, { data: profiles }] = await Promise.all([
      query,
      context.supabase.from("profiles").select("id, full_name, email"),
    ]);
    if (error) throw new Error(error.message);

    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email || "Usuário"]));
    return (events ?? []).map((e) => ({
      ...e,
      created_by_name: nameMap.get(e.created_by) ?? "Usuário",
    }));
  });

/** Verifica clientes sem movimentação e gera eventos CLIENTE_INATIVO. */
export const runInactiveCustomersCheck = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data?: { days?: number }) =>
    z.object({ days: z.number().min(7).max(720).default(90) }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: count, error } = await supabaseAdmin.rpc("detect_inactive_customers", {
      _days: data.days,
    });
    if (error) throw new Error(error.message);
    return { created: Number(count ?? 0) };
  });
