import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/supabase-auth.middleware";
import { z } from "zod";
import { recalcSalesForProducts } from "@/lib/order-recalc";
import { buildSku, calcMargin } from "@/lib/clothing";
import { fetchSuppliers } from "@/lib/store.functions";

const specSchema = z.object({ label: z.string().max(120), value: z.string().max(300) });

const productSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200),
  sku: z.string().max(60).optional().or(z.literal("")),
  description: z.string().max(2000).optional().or(z.literal("")),
  commercial_description: z.string().max(4000).optional().or(z.literal("")),
  technical_description: z.string().max(4000).optional().or(z.literal("")),
  purpose: z.string().max(2000).optional().or(z.literal("")),
  benefits: z.string().max(2000).optional().or(z.literal("")),
  applications: z.string().max(2000).optional().or(z.literal("")),
  dimensions: z.string().max(200).optional().or(z.literal("")),
  weight: z.string().max(100).optional().or(z.literal("")),
  specifications: z.array(specSchema).default([]),
  price: z.coerce.number().min(0, "Preço deve ser maior ou igual a zero"),
  category: z.string().max(80).optional().or(z.literal("")),
  code: z.string().max(60).optional().or(z.literal("")),
  margin_percent: z.coerce.number().default(0),
  stock: z.coerce.number().int().min(0).default(0),
  active: z.boolean().default(true),
  supplier: z.string().max(80).optional().or(z.literal("")),
  style: z.string().max(80).optional().or(z.literal("")),
  color: z.string().max(80).optional().or(z.literal("")),
  pattern: z.string().max(80).optional().or(z.literal("")),
  size: z.string().max(20).optional().or(z.literal("")),
  model_number: z.coerce.number().int().min(0).max(99).optional().nullable(),
  cost: z.coerce.number().min(0).default(0),
});

function clothingFields(
  d: z.infer<typeof productSchema>,
  suppliers: { value: string; code: string }[],
) {
  const sku = buildSku(d, suppliers);
  return {
    supplier: d.supplier || null,
    style: d.style || null,
    color: d.color || null,
    pattern: d.pattern || null,
    size: d.size || null,
    model_number: d.model_number ?? null,
    cost: d.cost,
    margin_percent: calcMargin(d.price, d.cost),
    sku: sku ?? (d.sku || null),
  };
}

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("products").select("*").order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: roles } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (!roles?.some((r: { role: string }) => r.role === "admin")) {
    throw new Error("Apenas administradores podem gerenciar produtos.");
  }
}

export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => productSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const suppliers = (await fetchSuppliers(context.supabase)).map((x) => ({
      value: x.name,
      code: x.code,
    }));
    const { data: inserted, error } = await context.supabase
      .from("products")
      .insert({
        name: data.name,
        description: data.description || null,
        commercial_description: data.commercial_description || null,
        technical_description: data.technical_description || null,
        purpose: data.purpose || null,
        benefits: data.benefits || null,
        applications: data.applications || null,
        dimensions: data.dimensions || null,
        weight: data.weight || null,
        specifications: data.specifications,
        price: data.price,
        category: data.category || null,
        code: data.code || null,
        stock: data.stock,
        active: data.active,
        ...clothingFields(data, suppliers),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

export const updateProduct = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => productSchema.extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { id, ...rest } = data;
    const suppliers = (await fetchSuppliers(context.supabase)).map((x) => ({
      value: x.name,
      code: x.code,
    }));
    const { data: current } = await context.supabase
      .from("products")
      .select("price")
      .eq("id", id)
      .single();
    const { error } = await context.supabase
      .from("products")
      .update({
        name: rest.name,
        description: rest.description || null,
        commercial_description: rest.commercial_description || null,
        technical_description: rest.technical_description || null,
        purpose: rest.purpose || null,
        benefits: rest.benefits || null,
        applications: rest.applications || null,
        dimensions: rest.dimensions || null,
        weight: rest.weight || null,
        specifications: rest.specifications,
        price: rest.price,
        category: rest.category || null,
        code: rest.code || null,
        stock: rest.stock,
        active: rest.active,
        ...clothingFields(rest, suppliers),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);

    // Custo pode ter mudado: atualiza lucro das vendas com este produto.
    await recalcSalesForProducts(context.supabase, [id]);

    // Registra alteração de preço
    if (current && Number(current.price) !== Number(rest.price)) {
      await context.supabase.from("product_price_history").insert({
        product_id: id,
        old_price: Number(current.price),
        new_price: Number(rest.price),
        changed_by: context.userId,
      });
    }
    return { ok: true };
  });

/** Apenas produtos ativos (usado em pedidos e orçamentos). */
export const listActiveProducts = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("products")
      .select("*")
      .eq("active", true)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listPriceHistory = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("product_price_history")
      .select("*")
      .eq("product_id", data.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getProduct = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const [productRes, imagesRes, docsRes] = await Promise.all([
      context.supabase.from("products").select("*").eq("id", data.id).single(),
      context.supabase
        .from("product_images")
        .select("*")
        .eq("product_id", data.id)
        .order("position")
        .order("created_at"),
      context.supabase.from("product_documents").select("*").eq("product_id", data.id),
    ]);
    if (productRes.error) throw new Error(productRes.error.message);

    async function resolve(url: string) {
      if (url.startsWith("http")) return url;
      const { data: signed } = await context.supabase.storage
        .from("product-assets")
        .createSignedUrl(url, 60 * 60);
      return signed?.signedUrl ?? url;
    }

    const images = await Promise.all(
      (imagesRes.data ?? []).map(async (i) => ({ ...i, signedUrl: await resolve(i.url) })),
    );
    const documents = await Promise.all(
      (docsRes.data ?? []).map(async (d) => ({ ...d, signedUrl: await resolve(d.url) })),
    );

    return { product: productRes.data, images, documents };
  });

export const addProductAsset = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { product_id: string; kind: string; url: string; name?: string }) =>
    z
      .object({
        product_id: z.string().uuid(),
        kind: z.enum(["image", "document"]),
        url: z.string().min(1).max(1000),
        name: z.string().max(200).optional().or(z.literal("")),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.kind === "image") {
      const { count } = await context.supabase
        .from("product_images")
        .select("id", { count: "exact", head: true })
        .eq("product_id", data.product_id);
      const { error } = await context.supabase
        .from("product_images")
        .insert({
          product_id: data.product_id,
          url: data.url,
          caption: data.name || null,
          position: count ?? 0,
        });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("product_documents")
        .insert({ product_id: data.product_id, url: data.url, name: data.name || "Documento" });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const removeProductAsset = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string; kind: string }) =>
    z.object({ id: z.string().uuid(), kind: z.enum(["image", "document"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const table = data.kind === "image" ? "product_images" : "product_documents";
    const { data: row } = await context.supabase
      .from(table)
      .select("url")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await context.supabase.from(table).delete().eq("id", data.id);
    if (!error && row?.url && !row.url.startsWith("http")) {
      await context.supabase.storage.from("product-assets").remove([row.url]);
    }
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Exclui um produto e seus anexos (apenas administradores). */
export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    await context.supabase.from("product_images").delete().eq("product_id", data.id);
    await context.supabase.from("product_documents").delete().eq("product_id", data.id);
    const { error } = await context.supabase.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Define a foto principal (posição 0) e reordena as demais. */
export const setPrimaryProductImage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { product_id: string; image_id: string }) =>
    z.object({ product_id: z.string().uuid(), image_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: imgs, error } = await context.supabase
      .from("product_images")
      .select("id, position, created_at")
      .eq("product_id", data.product_id)
      .order("position")
      .order("created_at");
    if (error) throw new Error(error.message);
    const ordered = [
      ...(imgs ?? []).filter((i) => i.id === data.image_id),
      ...(imgs ?? []).filter((i) => i.id !== data.image_id),
    ];
    for (const [pos, img] of ordered.entries()) {
      await context.supabase.from("product_images").update({ position: pos }).eq("id", img.id);
    }
    return { ok: true };
  });

/** Foto principal de cada produto (para a lista), com link assinado. */
export const listPrimaryImages = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("product_images")
      .select("product_id, url, position, created_at")
      .order("position")
      .order("created_at");
    if (error) return {} as Record<string, string>;
    const first: Record<string, string> = {};
    for (const img of data ?? []) if (!(img.product_id in first)) first[img.product_id] = img.url;
    const out: Record<string, string> = {};
    await Promise.all(
      Object.entries(first).map(async ([pid, url]) => {
        if (url.startsWith("http")) {
          out[pid] = url;
          return;
        }
        const { data: signed } = await context.supabase.storage
          .from("product-assets")
          .createSignedUrl(url, 60 * 60);
        if (signed?.signedUrl) out[pid] = signed.signedUrl;
      }),
    );
    return out;
  });
