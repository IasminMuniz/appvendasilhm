import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/supabase-auth.middleware";
import { z } from "zod";

const datasetSchema = z.enum(["customers", "leads", "products", "orders", "quotes"]);

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return "";
    const str = typeof value === "object" ? JSON.stringify(value) : String(value);
    return `"${str.replace(/"/g, '""')}"`;
  };
  return [
    headers.join(";"),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(";")),
  ].join("\n");
}

export const listExportJobs = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("export_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Exporta um conjunto de dados em CSV ou JSON e registra o job. */
export const exportDataset = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { dataset: string; format: string }) =>
    z.object({ dataset: datasetSchema, format: z.enum(["csv", "json"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const selects: Record<string, string> = {
      customers: "*",
      leads: "*",
      products: "*",
      orders: "*, order_items(*)",
      quotes: "*, quote_items(*)",
    };

    const { data: rows, error } = await context.supabase
      .from(data.dataset)
      .select(selects[data.dataset]!);
    if (error) throw new Error(error.message);

    const list = (rows ?? []) as unknown as Record<string, unknown>[];
    const content =
      data.format === "json" ? JSON.stringify(list, null, 2) : toCsv(list);
    const fileName = `${data.dataset}-${new Date().toISOString().slice(0, 10)}.${data.format}`;

    await context.supabase.from("export_jobs").insert({
      user_id: context.userId,
      dataset: data.dataset,
      format: data.format,
      file_name: fileName,
      row_count: list.length,
    });

    return { fileName, content, rowCount: list.length };
  });

/** Backup completo em JSON de todas as áreas comerciais acessíveis ao usuário. */
export const exportFullBackup = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const [customers, leads, products, orders, quotes, goals] = await Promise.all([
      supabase.from("customers").select("*"),
      supabase.from("leads").select("*"),
      supabase.from("products").select("*"),
      supabase.from("orders").select("*, order_items(*)"),
      supabase.from("quotes").select("*, quote_items(*)"),
      supabase.from("goals").select("*"),
    ]);

    const backup = {
      generated_at: new Date().toISOString(),
      customers: customers.data ?? [],
      leads: leads.data ?? [],
      products: products.data ?? [],
      orders: orders.data ?? [],
      quotes: quotes.data ?? [],
      goals: goals.data ?? [],
    };

    const fileName = `backup-comercial-${new Date().toISOString().slice(0, 10)}.json`;
    const rowCount = Object.values(backup)
      .filter(Array.isArray)
      .reduce((sum, arr) => sum + arr.length, 0);

    await context.supabase.from("export_jobs").insert({
      user_id: context.userId,
      dataset: "backup_completo",
      format: "json",
      file_name: fileName,
      row_count: rowCount,
    });

    return { fileName, content: JSON.stringify(backup, null, 2), rowCount };
  });
