/** Texto de anúncio no modelo padrão da loja (Shopee, Facebook e Marketplace). */
export interface AdProduct {
  name: string;
  style?: string | null;
  color?: string | null;
  pattern?: string | null;
  size?: string | null;
  condition?: string | null;
  condition_notes?: string | null;
}

export function buildAdText(p: AdProduct): string {
  const seminovo = p.condition === "seminovo";
  const opening = seminovo
    ? "♻️ Peça seminova em ótimo estado, pronta para um novo look!"
    : "✨ Peça linda e versátil, perfeita para arrasar em qualquer ocasião!";

  const traits = [
    p.style && `Modelo ${p.style.toLowerCase()}`,
    p.color && `Cor ${p.color.toLowerCase()}`,
    p.pattern && p.pattern,
    seminovo && (p.condition_notes?.trim() ? `Estado: ${p.condition_notes.trim()}` : "Seminova"),
  ].filter(Boolean) as string[];

  const size = !p.size || p.size === "Único" ? "Único (veste do 36 ao 42)" : p.size;

  return [
    p.name,
    "",
    opening,
    "",
    "👗 Características:",
    ...traits.map((t) => `• ${t}`),
    "",
    `📏 Tamanho: ${size}`,
    "",
    "🚇 Entrega no Metrô:",
    "• Linha 3-Vermelha: Bresser-Mooca, Belém, Tatuapé",
    "• Linha 1-Azul: Portuguesa-Tietê, Carandiru, Santana e Tucuruvi",
    "📅 Data e horário combinados previamente",
    "",
    "📦 Envio para todo o Brasil (Correios, Jadlog e outras transportadoras). Frete calculado pelo CEP. Envio somente após a confirmação do pagamento, com código de rastreio.",
    "",
    "💳 Pagamento: Pix ou cartão (aceito parcelamento). Não aceito dinheiro.",
  ].join("\n");
}
