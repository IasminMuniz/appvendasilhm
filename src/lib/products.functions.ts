import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/supabase-auth.middleware";
import { z } from "zod";

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
  active: z.boolean().default(true),
});

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
    const { data: inserted, error } = await context.supabase
      .from("products")
      .insert({
        name: data.name,
        sku: data.sku || null,
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
        active: data.active,
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
    const { error } = await context.supabase
      .from("products")
      .update({
        name: rest.name,
        sku: rest.sku || null,
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
        active: rest.active,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
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
        .order("position"),
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
      const { error } = await context.supabase
        .from("product_images")
        .insert({ product_id: data.product_id, url: data.url, caption: data.name || null });
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
    const { error } = await context.supabase.from(table).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
