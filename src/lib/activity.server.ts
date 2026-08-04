/**
 * Atualiza `ultima_interacao` (coluna existente `last_activity_at`) sempre que
 * ocorre uma interação comercial relevante. Nunca lança erro.
 */
type TouchClient = {
  from: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: unknown }>;
    };
  };
};

export async function touchLeadActivity(
  supabase: unknown,
  leadId: string | null | undefined,
): Promise<void> {
  if (!leadId) return;
  try {
    await (supabase as TouchClient)
      .from("leads")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("id", leadId);
  } catch (error) {
    console.error("[atividade] falha ao atualizar ultima_interacao do lead:", error);
  }
}

export async function touchCustomerActivity(
  supabase: unknown,
  customerId: string | null | undefined,
  userId?: string,
): Promise<void> {
  if (!customerId) return;
  try {
    await (supabase as TouchClient)
      .from("customers")
      .update({
        last_activity_at: new Date().toISOString(),
        ...(userId ? { updated_by: userId } : {}),
      })
      .eq("id", customerId);
  } catch (error) {
    console.error("[atividade] falha ao atualizar ultima_interacao do cliente:", error);
  }
}

/** Atualiza ambos quando o fluxo envolve lead e cliente. */
export async function touchActivity(
  supabase: unknown,
  params: { leadId?: string | null; customerId?: string | null; userId?: string },
): Promise<void> {
  await Promise.all([
    touchLeadActivity(supabase, params.leadId),
    touchCustomerActivity(supabase, params.customerId, params.userId),
  ]);
}
