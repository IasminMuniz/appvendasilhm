import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/supabase-auth.middleware";
import { z } from "zod";

const productSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  price: z.coerce.number().min(0, "Preço deve ser maior ou igual a zero"),
  active: z.boolean().default(true),
});

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("products")
      .select("*")
      .order("name");

    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => productSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    const isAdmin = roles?.some((r) => r.role === "admin");
    if (!isAdmin) throw new Error("Apenas administradores podem cadastrar produtos.");

    const { data: inserted, error } = await context.supabase
      .from("products")
      .insert({
        name: data.name,
        description: data.description || null,
        price: data.price,
        active: data.active,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return inserted;
  });

export const getProduct = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: product, error } = await context.supabase
      .from("products")
      .select("*")
      .eq("id", data.id)
      .single();

    if (error) throw new Error(error.message);
    return product;
  });
