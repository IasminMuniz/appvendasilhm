import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type QuotePdfData = {
  number: number | null;
  createdAt: string;
  validUntil: string | null;
  company: { name: string; document?: string; email?: string; phone?: string };
  customer: {
    name: string;
    company_name?: string | null;
    document?: string | null;
    email?: string | null;
    phone?: string | null;
    city?: string | null;
    state?: string | null;
  };
  seller: string;
  items: Array<{
    name: string;
    description: string | null;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    total: number;
  }>;
  subtotal: number;
  discountPercent: number;
  total: number;
  notes: string | null;
  commercialTerms: string | null;
};

const money = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Remove caracteres fora do WinAnsi aceito pelas fontes padrão do PDF. */
function safe(text: string): string {
  return (text ?? "").replace(/[^\x20-\x7E\u00A0-\u00FF]/g, " ");
}

export async function buildQuotePdf(data: QuotePdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([595, 842]);
  const margin = 48;
  const width = 595 - margin * 2;
  let y = 842 - margin;

  const primary = rgb(0.09, 0.24, 0.45);
  const muted = rgb(0.42, 0.45, 0.5);

  const text = (
    value: string,
    opts: { x?: number; size?: number; f?: typeof font; color?: ReturnType<typeof rgb> } = {},
  ) => {
    page.drawText(safe(value), {
      x: opts.x ?? margin,
      y,
      size: opts.size ?? 10,
      font: opts.f ?? font,
      color: opts.color ?? rgb(0.1, 0.1, 0.12),
    });
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      page = pdf.addPage([595, 842]);
      y = 842 - margin;
    }
  };

  // Cabeçalho / logo textual
  page.drawRectangle({ x: 0, y: 842 - 96, width: 595, height: 96, color: primary });
  page.drawRectangle({ x: margin, y: 842 - 74, width: 34, height: 34, color: rgb(1, 1, 1) });
  page.drawText("V", {
    x: margin + 11,
    y: 842 - 66,
    size: 20,
    font: bold,
    color: primary,
  });
  page.drawText(safe(data.company.name), {
    x: margin + 46,
    y: 842 - 52,
    size: 16,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(
    safe(
      [data.company.document, data.company.email, data.company.phone].filter(Boolean).join("  |  "),
    ),
    { x: margin + 46, y: 842 - 68, size: 8, font, color: rgb(0.85, 0.89, 0.95) },
  );
  page.drawText(safe(`ORÇAMENTO Nº ${data.number ?? "-"}`), {
    x: 595 - margin - 150,
    y: 842 - 52,
    size: 12,
    font: bold,
    color: rgb(1, 1, 1),
  });

  y = 842 - 130;

  text("CLIENTE", { f: bold, size: 9, color: muted });
  y -= 14;
  text(data.customer.company_name || data.customer.name, { f: bold, size: 12 });
  y -= 13;
  const customerLines = [
    data.customer.document ? `Documento: ${data.customer.document}` : null,
    [data.customer.email, data.customer.phone].filter(Boolean).join("  |  ") || null,
    [data.customer.city, data.customer.state].filter(Boolean).join(" / ") || null,
  ].filter(Boolean) as string[];
  for (const line of customerLines) {
    text(line, { size: 9, color: muted });
    y -= 12;
  }

  const meta = [
    `Data: ${new Date(data.createdAt).toLocaleDateString("pt-BR")}`,
    data.validUntil ? `Válido até: ${new Date(data.validUntil).toLocaleDateString("pt-BR")}` : null,
    `Consultor: ${data.seller}`,
  ].filter(Boolean) as string[];
  let metaY = 842 - 144;
  for (const line of meta) {
    page.drawText(safe(line), {
      x: 595 - margin - 190,
      y: metaY,
      size: 9,
      font,
      color: muted,
    });
    metaY -= 12;
  }

  y -= 12;

  // Tabela de itens
  const colQty = margin + 300;
  const colUnit = margin + 350;
  const colDisc = margin + 425;
  const colTotal = margin + 470;

  page.drawRectangle({ x: margin, y: y - 4, width, height: 20, color: rgb(0.93, 0.95, 0.98) });
  y += 2;
  text("PRODUTO", { f: bold, size: 9, color: primary });
  page.drawText("QTD", { x: colQty, y, size: 9, font: bold, color: primary });
  page.drawText("UNIT.", { x: colUnit, y, size: 9, font: bold, color: primary });
  page.drawText("DESC.", { x: colDisc, y, size: 9, font: bold, color: primary });
  page.drawText("TOTAL", { x: colTotal, y, size: 9, font: bold, color: primary });
  y -= 22;

  for (const item of data.items) {
    ensureSpace(48);
    text(item.name, { f: bold, size: 10 });
    page.drawText(String(item.quantity), { x: colQty, y, size: 10, font });
    page.drawText(money(item.unitPrice), { x: colUnit, y, size: 9, font });
    page.drawText(`${item.discountPercent}%`, { x: colDisc, y, size: 9, font });
    page.drawText(money(item.total), { x: colTotal, y, size: 9, font: bold });
    y -= 13;

    if (item.description) {
      const words = safe(item.description).split(/\s+/);
      let line = "";
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, 8) > 280) {
          text(line, { size: 8, color: muted });
          y -= 10;
          ensureSpace(24);
          line = word;
        } else {
          line = candidate;
        }
      }
      if (line) {
        text(line, { size: 8, color: muted });
        y -= 10;
      }
    }
    y -= 6;
    page.drawLine({
      start: { x: margin, y: y + 4 },
      end: { x: margin + width, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.88, 0.9, 0.93),
    });
    y -= 6;
  }

  // Totais
  ensureSpace(90);
  y -= 6;
  const totalsX = margin + 320;
  const rows: Array<[string, string, boolean]> = [
    ["Subtotal", money(data.subtotal), false],
    ["Desconto", `${data.discountPercent}%`, false],
    ["Total", money(data.total), true],
  ];
  for (const [label, value, strong] of rows) {
    page.drawText(safe(label), {
      x: totalsX,
      y,
      size: strong ? 12 : 10,
      font: strong ? bold : font,
      color: strong ? primary : muted,
    });
    page.drawText(safe(value), {
      x: colTotal,
      y,
      size: strong ? 12 : 10,
      font: strong ? bold : font,
      color: strong ? primary : rgb(0.1, 0.1, 0.12),
    });
    y -= strong ? 20 : 15;
  }

  const blocks: Array<[string, string | null]> = [
    ["OBSERVAÇÕES", data.notes],
    ["CONDIÇÕES COMERCIAIS", data.commercialTerms],
  ];
  for (const [title, content] of blocks) {
    if (!content) continue;
    ensureSpace(60);
    y -= 10;
    text(title, { f: bold, size: 9, color: primary });
    y -= 14;
    const words = safe(content).split(/\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, 9) > width) {
        text(line, { size: 9, color: muted });
        y -= 12;
        ensureSpace(24);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) {
      text(line, { size: 9, color: muted });
      y -= 12;
    }
  }

  return pdf.save();
}
