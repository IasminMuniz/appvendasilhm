import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/supabase-auth.middleware";
import { parseQuotes } from "@/lib/freight";
import { effectivePackaging, profitOf } from "@/lib/sales";
import { reservePctOf } from "@/lib/order-recalc";

const KEY = "freight_settings";

async function readSettings(supabase: any): Promise<{ origin_cep: string; contact_email: string }> {
  const { data } = await supabase.from("store_settings").select("value").eq("key", KEY).maybeSingle();
  const v = (data?.value ?? {}) as any;
  return { origin_cep: String(v.origin_cep ?? ""), contact_email: String(v.contact_email ?? "") };
}

export const getFreightSettings = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => readSettings(context.supabase));

export const saveFreightSettings = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        origin_cep: z.string().regex(/^\d{5}-?\d{3}$/, "CEP de origem inválido"),
        contact_email: z.string().email("E-mail inválido").max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("store_settings").upsert({
      key: KEY,
      value: { origin_cep: data.origin_cep.replace(/\D/g, ""), contact_email: data.contact_email },
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Cota frete no Melhor Envio. O token fica só no servidor. */
export const cotarFrete = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        cep_destino: z.string().regex(/^\d{5}-?\d{3}$/, "CEP de destino inválido"),
        peso_kg: z.coerce.number().positive().max(30),
        altura_cm: z.coerce.number().positive().max(200),
        largura_cm: z.coerce.number().positive().max(200),
        comprimento_cm: z.coerce.number().positive().max(200),
        valor_declarado: z.coerce.number().min(0).max(100000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const token = process.env["MELHOR_ENVIO_TOKEN"];
    if (!token) throw new Error("Token do Melhor Envio não configurado.");
    const s = await readSettings(context.supabase);
    if (!s.origin_cep) throw new Error("Cadastre o CEP de origem da loja antes de cotar.");
    const res = await fetch("https://melhorenvio.com.br/api/v2/me/shipment/calculate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": `Nexus360 (${s.contact_email || "contato@nexus360.app"})`,
      },
      body: JSON.stringify({
        from: { postal_code: s.origin_cep },
        to: { postal_code: data.cep_destino.replace(/\D/g, "") },
        package: {
          height: data.altura_cm,
          width: data.largura_cm,
          length: data.comprimento_cm,
          weight: data.peso_kg,
        },
        options: { insurance_value: data.valor_declarado ?? 0, receipt: false, own_hand: false },
      }),
    });
    const body = await res.json().catch(() => null);
    if (res.status === 401 || res.status === 403)
      throw new Error("Token do Melhor Envio inválido ou expirado. Atualize o token nas configurações.");
    if (!res.ok) {
      console.error("Melhor Envio", res.status, body);
      const txt = JSON.stringify(body ?? "").toLowerCase();
      if (res.status === 422 || txt.includes("postal_code") || txt.includes("cep"))
        throw new Error("CEP inválido ou não atendido. Confira o CEP e tente novamente.");
      throw new Error("Não foi possível cotar o frete agora. Tente novamente em instantes.");
    }
    const quotes = parseQuotes(body);
    if (quotes.length === 0)
      throw new Error("Nenhuma transportadora atende esse CEP com este pacote.");
    return { quotes };
  });

/**
 * Lança o frete escolhido na venda.
 * - "loja": frete por conta da loja → entra em Outros custos (tipo Frete/entrega) e reduz o lucro.
 * - "cliente": cliente paga à parte → só registra na observação, sem mexer no lucro.
 * Reaplicar troca o frete anterior em vez de somar de novo.
 */
export const usarFreteNaVenda = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        order_id: z.string().uuid(),
        transportadora: z.string().min(1).max(80),
        servico: z.string().max(80),
        preco: z.coerce.number().positive().max(10000),
        prazo_dias: z.coerce.number().int().min(0).max(120).nullable().optional(),
        quem_paga: z.enum(["loja", "cliente"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: order, error: readError } = await context.supabase
      .from("orders")
      .select("*")
      .eq("id", data.order_id)
      .single();
    if (readError || !order) throw new Error("Venda não encontrada.");

    const FRETE = "Frete/entrega";
    const prevCost = Number(order.other_costs ?? 0);
    const prevIsFreight = order.other_cost_type === FRETE;
    const round2 = (n: number) => Math.round(n * 100) / 100;

    let otherCosts = prevCost;
    let otherType: string | null = order.other_cost_type ?? null;
    if (data.quem_paga === "loja") {
      if (prevIsFreight || prevCost === 0) {
        otherCosts = data.preco;
        otherType = FRETE;
      } else {
        otherCosts = round2(prevCost + data.preco); // já havia outro custo: soma
      }
    } else if (prevIsFreight) {
      otherCosts = 0; // frete que estava por conta da loja passou para a cliente
      otherType = null;
    }

    const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const linha =
      `Frete: ${data.transportadora} ${data.servico} – ${fmt(data.preco)}` +
      (data.prazo_dias != null ? ` – ${data.prazo_dias} dia(s) úteis` : "") +
      (data.quem_paga === "loja" ? " (por conta da loja)" : " (pago pela cliente)");
    const outras = String(order.notes ?? "")
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("Frete: "));
    const notes = [linha, ...outras].join("\n");

    const { profit, margin } = profitOf({
      total: Number(order.total ?? 0),
      channelFee: Number(order.channel_fee ?? 0),
      otherCosts,
      productCost: Number(order.product_cost ?? 0),
      packaging: effectivePackaging(order),
      reservePct: await reservePctOf(context.supabase),
    });

    const { error } = await context.supabase
      .from("orders")
      .update({
        other_costs: otherCosts,
        other_cost_type: otherType,
        delivery_method: "Correios/plataforma de frete",
        notes,
        profit,
        margin_percent: margin,
      })
      .eq("id", data.order_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
