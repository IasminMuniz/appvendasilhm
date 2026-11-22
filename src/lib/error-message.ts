const FIELD_LABELS: Record<string, string> = {
  phone: "Telefone / WhatsApp",
  instagram: "Instagram",
  address: "Endereço",
  notes: "Observações",
  name: "Nome",
};

/** Transforma erros de validação (JSON do zod) em uma frase legível. */
export function friendlyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  try {
    const issues = JSON.parse(raw);
    if (Array.isArray(issues) && issues.length) {
      return issues
        .map((i: { path?: unknown[]; message?: string; code?: string; maximum?: number }) => {
          const key = String(i.path?.[0] ?? "");
          const label = FIELD_LABELS[key] ?? key;
          const msg =
            i.message && i.message !== "Invalid input"
              ? i.message
              : i.code === "too_big"
                ? `texto muito longo (máx. ${i.maximum} caracteres)`
                : "valor inválido";
          return label ? `${label}: ${msg}` : msg;
        })
        .join(" · ");
    }
  } catch {
    /* não é JSON */
  }
  return raw;
}
