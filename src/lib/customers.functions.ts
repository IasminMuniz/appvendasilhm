import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/supabase-auth.middleware";
import { z } from "zod";

const customerSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
  state: z.string().max(50).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("customers")
      .select("*")
      .order("name");

    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createCustomer = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => customerSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: inserted, error } = await context.supabase
      .from("customers")
      .insert({
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        notes: data.notes || null,
        seller_id: context.userId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return inserted;
  });

export const getCustomer = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: customer, error } = await context.supabase
      .from("customers")
      .select("*")
      .eq("id", data.id)
      .single();

    if (error) throw new Error(error.message);
    return customer;
  });
