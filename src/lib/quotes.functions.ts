import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/supabase-auth.middleware";
import { z } from "zod";

const quoteItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.coerce.number().int().min(1),
  unit_price: z.coerce.number().min(0),
  discount_percent: z.coerce.number().min(0).max(100).default(0),
});

const quoteSchema = z.object({
  customer_id: z.string().uuid(),
  discount_percent: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().max(2000).optional().or(z.literal("")),
  commercial_terms: z.string().max(2000).optional().or(z.literal("")),
  valid_until: z.string().optional().or(z.literal("")),
  items: z.array(quoteItemSchema).min(1, "Adicione pelo menos um item"),
});

export const listQuotes = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("quotes")
      .select("*, customers(name, company_name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getQuote = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const [quoteRes, approvalsRes, sendsRes, policiesRes] = await Promise.all([
      context.supabase
        .from("quotes")
        .select("*, customers(*), quote_items(*, products(name, commercial_description))")
        .eq("id", data.id)
        .single(),
      context.supabase
        .from("quote_approvals")
        .select("*")
        .eq("quote_id", data.id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("quote_sends")
        .select("*")
        .eq("quote_id", data.id)
        .order("created_at", { ascending: false }),
      context.supabase.from("discount_policies").select("*"),
    ]);
    if (quoteRes.error) throw new Error(quoteRes.error.message);

    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    return {
      quote: quoteRes.data,
      approvals: approvalsRes.data ?? [],
      sends: sendsRes.data ?? [],
      policies: policiesRes.data ?? [],
      myRoles: roles?.map((r) => r.role) ?? [],
      userId: context.userId,
    };
  });

export const getDiscountPolicies = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const [policiesRes, rolesRes] = await Promise.all([
      context.supabase.from("discount_policies").select("*"),
      context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
    ]);
    const roles = rolesRes.data?.map((r) => r.role) ?? [];
    const policies = policiesRes.data ?? [];
    const myLimit = policies
      .filter((p) => roles.includes(p.role))
      .reduce((max, p) => Math.max(max, Number(p.max_discount_percent)), 0);
    return { policies, roles, myLimit };
  });

function computeTotals(
  items: Array<{ quantity: number; unit_price: number; discount_percent: number }>,
  headerDiscount: number,
) {
  const itemTotals = items.map(
    (i) => i.quantity * i.unit_price * (1 - (i.discount_percent || 0) / 100),
  );
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const afterItemDiscount = itemTotals.reduce((sum, t) => sum + t, 0);
  const total = afterItemDiscount * (1 - (headerDiscount || 0) / 100);
  const effectiveDiscount = subtotal > 0 ? ((subtotal - total) / subtotal) * 100 : 0;
  return { subtotal, total, itemTotals, effectiveDiscount };
}

export const createQuote = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => quoteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { subtotal, total, itemTotals } = computeTotals(data.items, data.discount_percent);

    const { data: quote, error } = await context.supabase
      .from("quotes")
      .insert({
        customer_id: data.customer_id,
        seller_id: context.userId,
        discount_percent: data.discount_percent,
        subtotal,
        total,
        notes: data.notes || null,
        commercial_terms: data.commercial_terms || null,
        valid_until: data.valid_until || null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const { error: itemsError } = await context.supabase.from("quote_items").insert(
      data.items.map((item, index) => ({
        quote_id: quote.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent,
        total: itemTotals[index]!,
      })),
    );
    if (itemsError) {
      await context.supabase.from("quotes").delete().eq("id", quote.id);
      throw new Error(itemsError.message);
    }

    return quote;
  });

/** Envia para aprovação: valida o limite de desconto do perfil do solicitante. */
export const submitQuote = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string; note?: string }) =>
    z
      .object({ id: z.string().uuid(), note: z.string().max(500).optional().or(z.literal("")) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const [{ data: quote, error }, { data: policies }, { data: roles }] = await Promise.all([
      context.supabase.from("quotes").select("*").eq("id", data.id).single(),
      context.supabase.from("discount_policies").select("*"),
      context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
    ]);
    if (error) throw new Error(error.message);

    const myRoles = roles?.map((r) => r.role) ?? [];
    const myLimit = (policies ?? [])
      .filter((p) => myRoles.includes(p.role))
      .reduce((max, p) => Math.max(max, Number(p.max_discount_percent)), 0);

    const discount = Number(quote.discount_percent ?? 0);

    if (discount <= myLimit) {
      const { error: upErr } = await context.supabase
        .from("quotes")
        .update({ status: "aprovado" })
        .eq("id", data.id);
      if (upErr) throw new Error(upErr.message);
      await context.supabase.from("quote_approvals").insert({
        quote_id: data.id,
        requested_by: context.userId,
        approver_id: context.userId,
        required_role: (myRoles[0] as "admin") ?? "vendedor",
        discount_percent: discount,
        status: "aprovado_automatico",
        note: "Desconto dentro do limite do perfil",
        decided_at: new Date().toISOString(),
      });
      return { status: "aprovado" as const, requiredRole: null };
    }

    const ordered = ["vendedor", "supervisor", "gerente", "admin"] as const;
    const requiredRole =
      ordered.find(
        (role) =>
          Number(
            (policies ?? []).find((p) => p.role === role)?.max_discount_percent ?? 0,
          ) >= discount,
      ) ?? "admin";

    const { error: upErr } = await context.supabase
      .from("quotes")
      .update({ status: "aguardando_aprovacao" })
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);

    const { error: apErr } = await context.supabase.from("quote_approvals").insert({
      quote_id: data.id,
      requested_by: context.userId,
      required_role: requiredRole,
      discount_percent: discount,
      status: "pendente",
      note: data.note || null,
    });
    if (apErr) throw new Error(apErr.message);

    return { status: "aguardando_aprovacao" as const, requiredRole };
  });

export const decideQuote = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string; approve: boolean; note?: string }) =>
    z
      .object({
        id: z.string().uuid(),
        approve: z.boolean(),
        note: z.string().max(500).optional().or(z.literal("")),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: pending } = await context.supabase
      .from("quote_approvals")
      .select("*")
      .eq("quote_id", data.id)
      .eq("status", "pendente")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await context.supabase
      .from("quotes")
      .update({ status: data.approve ? "aprovado" : "reprovado" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    if (pending) {
      await context.supabase
        .from("quote_approvals")
        .update({
          approver_id: context.userId,
          status: data.approve ? "aprovado" : "reprovado",
          note: data.note || pending.note,
          decided_at: new Date().toISOString(),
        })
        .eq("id", pending.id);
    }

    return { ok: true };
  });

export const convertQuoteToOrder = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: quote, error } = await context.supabase
      .from("quotes")
      .select("*, quote_items(*)")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    if (quote.status !== "aprovado") throw new Error("Somente orçamentos aprovados podem virar pedido.");
    if (quote.order_id) return { orderId: quote.order_id };

    const { data: order, error: orderError } = await context.supabase
      .from("orders")
      .insert({
        customer_id: quote.customer_id,
        seller_id: context.userId,
        total: quote.total,
        status: "criado",
        notes: quote.notes,
      })
      .select()
      .single();
    if (orderError) throw new Error(orderError.message);

    const { error: itemsError } = await context.supabase.from("order_items").insert(
      (quote.quote_items ?? []).map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
      })),
    );
    if (itemsError) {
      await context.supabase.from("orders").delete().eq("id", order.id);
      throw new Error(itemsError.message);
    }

    await context.supabase
      .from("quotes")
      .update({ status: "convertido", order_id: order.id })
      .eq("id", data.id);

    await context.supabase.from("order_status_history").insert({
      order_id: order.id,
      from_status: null,
      to_status: "criado",
      changed_by: context.userId,
      note: `Gerado a partir do orçamento #${quote.number}`,
    });

    return { orderId: order.id };
  });

export const deleteQuote = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("quotes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Gera o PDF do orçamento e devolve em base64 para download no navegador. */
export const generateQuotePdf = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { buildQuotePdf } = await import("@/lib/quote-pdf.server");

    const { data: quote, error } = await context.supabase
      .from("quotes")
      .select("*, customers(*), quote_items(*, products(name, commercial_description, description))")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", quote.seller_id)
      .maybeSingle();

    const bytes = await buildQuotePdf({
      number: quote.number,
      createdAt: quote.created_at,
      validUntil: quote.valid_until,
      company: { name: "Vendas Comercial" },
      customer: quote.customers as never,
      seller: profile?.full_name || profile?.email || "Consultor comercial",
      items: (quote.quote_items ?? []).map((item) => ({
        name: item.products?.name ?? "Produto",
        description: item.products?.commercial_description ?? item.products?.description ?? null,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        discountPercent: Number(item.discount_percent ?? 0),
        total: Number(item.total),
      })),
      subtotal: Number(quote.subtotal ?? 0),
      discountPercent: Number(quote.discount_percent ?? 0),
      total: Number(quote.total ?? 0),
      notes: quote.notes,
      commercialTerms: quote.commercial_terms,
    });

    let binary = "";
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }

    return { fileName: `orcamento-${quote.number ?? quote.id}.pdf`, base64: btoa(binary) };
  });

/** Envia o orçamento por e-mail com o PDF anexado e registra o histórico. */
export const sendQuoteEmail = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string; to: string; subject: string; message: string }) =>
    z
      .object({
        id: z.string().uuid(),
        to: z.string().email("E-mail inválido"),
        subject: z.string().min(1).max(200),
        message: z.string().max(4000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { buildQuotePdf } = await import("@/lib/quote-pdf.server");
    const { sendLovableEmail } = await import("@lovable.dev/email-js");

    const { data: quote, error } = await context.supabase
      .from("quotes")
      .select("*, customers(*), quote_items(*, products(name, commercial_description, description))")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", quote.seller_id)
      .maybeSingle();

    const bytes = await buildQuotePdf({
      number: quote.number,
      createdAt: quote.created_at,
      validUntil: quote.valid_until,
      company: { name: "Vendas Comercial" },
      customer: quote.customers as never,
      seller: profile?.full_name || profile?.email || "Consultor comercial",
      items: (quote.quote_items ?? []).map((item) => ({
        name: item.products?.name ?? "Produto",
        description: item.products?.commercial_description ?? item.products?.description ?? null,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        discountPercent: Number(item.discount_percent ?? 0),
        total: Number(item.total),
      })),
      subtotal: Number(quote.subtotal ?? 0),
      discountPercent: Number(quote.discount_percent ?? 0),
      total: Number(quote.total ?? 0),
      notes: quote.notes,
      commercialTerms: quote.commercial_terms,
    });

    // O PDF é hospedado no armazenamento privado e enviado como link assinado.
    const path = `${data.id}/orcamento-${quote.number ?? quote.id}-${Date.now()}.pdf`;
    const { error: uploadError } = await context.supabase.storage
      .from("quote-pdfs")
      .upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    const { data: signed } = await context.supabase.storage
      .from("quote-pdfs")
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    const pdfUrl = signed?.signedUrl ?? "";

    const fromAddress = process.env["QUOTE_EMAIL_FROM"];
    let status = "enviado";
    let errorMessage: string | null = null;

    const body = `${data.message
      .split("\n")
      .map((line) => `<p>${line}</p>`)
      .join("")}<p><a href="${pdfUrl}">Baixar o orçamento em PDF</a></p>`;

    try {
      if (!fromAddress) {
        throw new Error(
          "Remetente de e-mail não configurado. Configure o domínio de e-mail para enviar orçamentos.",
        );
      }
      await sendLovableEmail(
        {
          to: data.to,
          from: fromAddress,
          subject: data.subject,
          html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6">${body}</div>`,
          text: `${data.message}\n\nPDF: ${pdfUrl}`,
        },
        { apiKey: process.env["LOVABLE_API_KEY"]! },
      );
    } catch (e) {
      status = "falha";
      errorMessage = e instanceof Error ? e.message : "Falha ao enviar e-mail";
    }

    await context.supabase.from("quote_sends").insert({
      quote_id: data.id,
      sent_by: context.userId,
      to_email: data.to,
      subject: data.subject,
      message: data.message,
      status,
      pdf_path: path,
    });

    if (errorMessage) throw new Error(errorMessage);
    return { ok: true, pdfUrl };
  });

