import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/supabase-auth.middleware";
import { z } from "zod";
import { SUPPLIERS, nextModelNumber, nextSupplierCode } from "@/lib/clothing";
import { DEFAULT_PACKAGING_COST } from "@/lib/sales";
import { type CashPlan, normalizePlan } from "@/lib/cash";

export interface SupplierRow {
  id: string | null;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  instagram: string | null;
  notes: string | null;
}

/** Lê os fornecedores; se a tabela ainda não existir, usa a lista padrão. */
export async function fetchSuppliers(supabase: any): Promise<SupplierRow[]> {
  const { data, error } = await supabase.from("suppliers").select("*").order("code");
  if (error || !data) {
    return SUPPLIERS.map((s) => ({
      id: null,
      code: s.code,
      name: s.value,
      address: null,
      phone: null,
      instagram: null,
      notes: null,
    }));
  }
  return data;
}

/** Lê o custo de embalagem por peça; sem configuração, usa o padrão. */
export async function fetchPackagingCost(supabase: any): Promise<number> {
  const { data, error } = await supabase
    .from("store_settings")
    .select("value")
    .eq("key", "packaging_cost")
    .maybeSingle();
  const n = Number(data?.value);
  return error || !Number.isFinite(n) || n < 0 ? DEFAULT_PACKAGING_COST : n;
}

export const listSuppliers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => fetchSuppliers(context.supabase));

const supplierSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Nome é obrigatório").max(80),
  address: z.string().max(300).optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  instagram: z.string().max(80).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export const saveSupplier = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => supplierSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...r } = data;
    const row = {
      name: r.name,
      address: r.address || null,
      phone: r.phone || null,
      instagram: r.instagram || null,
      notes: r.notes || null,
    };
    if (id) {
      const { data: before } = await context.supabase
        .from("suppliers")
        .select("name")
        .eq("id", id)
        .single();
      const { error } = await context.supabase.from("suppliers").update(row).eq("id", id);
      if (error) throw new Error(error.message);
      // Mantém produtos e compras ligados ao fornecedor se o nome mudar.
      if (before && before.name !== row.name) {
        await context.supabase
          .from("products")
          .update({ supplier: row.name })
          .eq("supplier", before.name);
        await context.supabase
          .from("purchases")
          .update({ supplier: row.name })
          .eq("supplier", before.name);
      }
      return { ok: true };
    }
    const { data: existing, error: readError } = await context.supabase
      .from("suppliers")
      .select("code");
    if (readError) throw new Error(readError.message);
    const code = nextSupplierCode((existing ?? []).map((s) => s.code));
    const { error } = await context.supabase
      .from("suppliers")
      .insert({ ...row, code, created_by: context.userId });
    if (error)
      throw new Error(
        error.message.includes("duplicate")
          ? "Já existe um fornecedor com esse nome."
          : error.message,
      );
    return { ok: true, code };
  });

export const deleteSupplier = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: sup } = await context.supabase
      .from("suppliers")
      .select("name")
      .eq("id", data.id)
      .single();
    if (sup) {
      const { count } = await context.supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("supplier", sup.name);
      if ((count ?? 0) > 0)
        throw new Error(
          "Este fornecedor tem produtos cadastrados. Altere os produtos antes de excluir.",
        );
    }
    const { error } = await context.supabase.from("suppliers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPackagingCost = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => ({ value: await fetchPackagingCost(context.supabase) }));

export const savePackagingCost = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ value: z.coerce.number().min(0).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("store_settings")
      .upsert({
        key: "packaging_cost",
        value: data.value,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Próximo Modelo nº livre para a combinação fornecedor + estilo + cor + padrão. */
export const getNextModelNumber = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        supplier: z.string().max(80),
        style: z.string().max(80),
        color: z.string().max(80),
        pattern: z.string().max(80),
        excludeId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("products")
      .select("id, model_number")
      .eq("supplier", data.supplier)
      .eq("style", data.style)
      .eq("color", data.color)
      .eq("pattern", data.pattern);
    if (data.excludeId) q = q.neq("id", data.excludeId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { next: nextModelNumber((rows ?? []).map((r) => r.model_number)) };
  });

/** Plano do caixa (aporte inicial e % de cada pote), guardado nas configurações da loja. */
export async function fetchCashPlan(supabase: any): Promise<CashPlan> {
  const { data, error } = await supabase.from("store_settings").select("value").eq("key", "cash_plan").maybeSingle();
  return normalizePlan(error ? null : data?.value);
}

export const saveCashPlan = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        initialCapital: z.coerce.number().min(0).max(10_000_000),
        otherPurposesPct: z.coerce.number().min(0).max(100),
        reservePct: z.coerce.number().min(0).max(100),
        growthPct: z.coerce.number().min(0).max(100),
      })
      .refine((p) => p.reservePct + p.growthPct <= 100, "Reserva + crescimento não podem passar de 100% do lucro.")
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("store_settings")
      .upsert({ key: "cash_plan", value: data, updated_by: context.userId, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
