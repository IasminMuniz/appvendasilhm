import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/supabase-auth.middleware";
import { parseQuotes } from "@/lib/freight";
import { effectivePackaging, profitOf } from "@/lib/sales";
import { saleDeductionsOf } from "@/lib/order-recalc";

const KEY = "freight_settings";

/** Remetente: dados da loja impressos na etiqueta do Melhor Envio. */
export interface Sender {
  name: string;
  document: string;
  phone: string;
  address: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
}
const EMPTY_SENDER: Sender = {
  name: "",
  document: "",
  phone: "",
  address: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
};

async function readSettings(
  supabase: any,
): Promise<{ origin_cep: string; contact_email: string; sender: Sender }> {
  const { data } = await supabase
    .from("store_settings")
    .select("value")
    .eq("key", KEY)
    .maybeSingle();
  const v = (data?.value ?? {}) as any;
  const sender = { ...EMPTY_SENDER };
  for (const k of Object.keys(EMPTY_SENDER) as (keyof Sender)[])
    sender[k] = String(v.sender?.[k] ?? "");
  return {
    origin_cep: String(v.origin_cep ?? ""),
    contact_email: String(v.contact_email ?? ""),
    sender,
  };
}

const senderSchema = z.object({
  name: z.string().max(120).default(""),
  document: z.string().max(20).default(""),
  phone: z.string().max(20).default(""),
  address: z.string().max(200).default(""),
  number: z.string().max(20).default(""),
  complement: z.string().max(100).default(""),
  district: z.string().max(100).default(""),
  city: z.string().max(100).default(""),
  state: z.string().max(2).default(""),
});

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
        sender: senderSchema.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const prev = await readSettings(context.supabase);
    const { error } = await context.supabase.from("store_settings").upsert({
      key: KEY,
      value: {
        origin_cep: data.origin_cep.replace(/\D/g, ""),
        contact_email: data.contact_email,
        sender: { ...(data.sender ?? prev.sender) },
      },
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
      throw new Error(
        "Token do Melhor Envio inválido ou expirado. Atualize o token nas configurações.",
      );
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
      ...(await saleDeductionsOf(context.supabase)),
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

const digits = (s: string) => s.replace(/\D/g, "");

/** Mensagem legível a partir do erro do Melhor Envio. */
function meError(status: number, body: any): string {
  if (status === 401 || status === 403)
    return "O token do Melhor Envio não tem permissão para criar envios. Gere um novo token no Melhor Envio marcando as permissões de carrinho (cart-read e cart-write) e atualize no Nexus.";
  const errs = body?.errors && typeof body.errors === "object" ? Object.values(body.errors) : [];
  const first = errs.flat().find((e) => typeof e === "string") as string | undefined;
  if (first) return `Melhor Envio: ${first}`;
  if (typeof body?.message === "string") return `Melhor Envio: ${body.message}`;
  return "Não foi possível enviar ao Melhor Envio agora. Tente novamente em instantes.";
}

/**
 * Coloca o envio da venda no carrinho do Melhor Envio, já com remetente, destinatária,
 * produtos e pacote. Pagar e imprimir a etiqueta continua sendo feito no Melhor Envio.
 */
export const enviarParaMelhorEnvio = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        order_id: z.string().uuid(),
        service_id: z.coerce.number().int().positive(),
        package: z.object({
          height: z.coerce.number().positive().max(200),
          width: z.coerce.number().positive().max(200),
          length: z.coerce.number().positive().max(200),
          weight: z.coerce.number().positive().max(30),
        }),
        insurance_value: z.coerce.number().min(0).max(100000).default(0),
        to: z.object({
          name: z.string().min(1, "Informe o nome da cliente").max(120),
          document: z
            .string()
            .refine((v) => [11, 14].includes(digits(v).length), "CPF da cliente inválido"),
          phone: z.string().max(20).default(""),
          email: z.string().max(200).default(""),
          address: z.string().min(1, "Informe a rua da cliente").max(200),
          number: z.string().min(1, "Informe o número do endereço").max(20),
          complement: z.string().max(100).default(""),
          district: z.string().min(1, "Informe o bairro da cliente").max(100),
          city: z.string().min(1, "Informe a cidade da cliente").max(100),
          state: z.string().length(2, "Informe a UF da cliente (ex.: SP)"),
          postal_code: z.string().regex(/^\d{5}-?\d{3}$/, "CEP da cliente inválido"),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const token = process.env["MELHOR_ENVIO_TOKEN"];
    if (!token) throw new Error("Token do Melhor Envio não configurado.");
    const s = await readSettings(context.supabase);
    const f = s.sender;
    const missing = (
      [
        ["nome", f.name],
        ["CPF/CNPJ", f.document],
        ["telefone", f.phone],
        ["rua", f.address],
        ["número", f.number],
        ["bairro", f.district],
        ["cidade", f.city],
        ["UF", f.state],
        ["CEP de origem", s.origin_cep],
      ] as const
    )
      .filter(([, v]) => !String(v).trim())
      .map(([k]) => k);
    if (missing.length)
      throw new Error(
        `Complete os dados do remetente em Cotar Frete → Configuração da loja: ${missing.join(", ")}.`,
      );

    const { data: order, error } = await context.supabase
      .from("orders")
      .select("*, order_items(quantity, unit_price, products(name))")
      .eq("id", data.order_id)
      .single();
    if (error || !order) throw new Error("Venda não encontrada.");

    const products = (order.order_items ?? []).map((i: any) => ({
      name: String(i.products?.name ?? "Peça de roupa").slice(0, 100),
      quantity: Number(i.quantity ?? 1),
      unitary_value: Number(i.unit_price ?? 0),
    }));
    const senderDoc = digits(f.document);
    const to = data.to;

    const res = await fetch("https://melhorenvio.com.br/api/v2/me/cart", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": `Nexus360 (${s.contact_email || "contato@nexus360.app"})`,
      },
      body: JSON.stringify({
        service: data.service_id,
        from: {
          name: f.name,
          phone: digits(f.phone),
          email: s.contact_email,
          ...(senderDoc.length === 14 ? { company_document: senderDoc } : { document: senderDoc }),
          address: f.address,
          number: f.number,
          complement: f.complement,
          district: f.district,
          city: f.city,
          state_abbr: f.state.toUpperCase(),
          country_id: "BR",
          postal_code: digits(s.origin_cep),
        },
        to: {
          name: to.name,
          phone: digits(to.phone),
          email: to.email,
          document: digits(to.document),
          address: to.address,
          number: to.number,
          complement: to.complement,
          district: to.district,
          city: to.city,
          state_abbr: to.state.toUpperCase(),
          country_id: "BR",
          postal_code: digits(to.postal_code),
        },
        products,
        volumes: [data.package],
        options: {
          insurance_value: data.insurance_value,
          receipt: false,
          own_hand: false,
          reverse: false,
          // Sem nota fiscal: segue com declaração de conteúdo.
          non_commercial: true,
          platform: "Nexus 360",
        },
      }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      console.error("Melhor Envio carrinho", res.status, body);
      throw new Error(meError(res.status, body));
    }

    // Anota na venda que o envio já está no carrinho do Melhor Envio.
    const linha = `Melhor Envio: envio no carrinho${body?.protocol ? ` (${body.protocol})` : ""}`;
    const outras = String(order.notes ?? "")
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("Melhor Envio:"));
    await context.supabase
      .from("orders")
      .update({ notes: [...outras, linha].join("\n") })
      .eq("id", data.order_id);

    return { ok: true, id: body?.id ?? null, protocol: body?.protocol ?? null };
  });

/** Dados da cliente da venda, para preencher a etiqueta. */
export const dadosEnvioDaVenda = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: { order_id: string }) => z.object({ order_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: order, error } = await context.supabase
      .from("orders")
      .select("total, customers(name, document, phone, email, address, city, state, postal_code)")
      .eq("id", data.order_id)
      .single();
    if (error || !order) throw new Error("Venda não encontrada.");
    const c = (order.customers ?? {}) as Record<string, string | null>;
    return {
      total: Number(order.total ?? 0),
      name: c.name ?? "",
      document: c.document ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      address: c.address ?? "",
      city: c.city ?? "",
      state: c.state ?? "",
      postal_code: c.postal_code ?? "",
    };
  });
