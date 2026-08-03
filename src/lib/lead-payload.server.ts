type Lead = Record<string, unknown> & { owner_id?: string | null };

type QueryClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
        single: () => Promise<{ data: Record<string, unknown> | null }>;
      };
    };
  };
};

/**
 * Monta o payload completo do lead enviado ao n8n, incluindo o e-mail do
 * responsável e o e-mail do supervisor (quando houver).
 */
export async function buildLeadPayload(
  supabase: unknown,
  lead: Lead,
  extra: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const client = supabase as QueryClient;
  let responsavelEmail: string | null = null;
  let supervisorEmail: string | null = null;
  let responsavelNome: string | null = null;

  const ownerId = (lead.owner_id as string | null) ?? null;
  if (ownerId) {
    try {
      const { data: owner } = await client
        .from("profiles")
        .select("id, full_name, email, supervisor_id")
        .eq("id", ownerId)
        .maybeSingle();
      responsavelEmail = (owner?.email as string | null) ?? null;
      responsavelNome = (owner?.full_name as string | null) ?? null;
      const supervisorId = (owner?.supervisor_id as string | null) ?? null;
      if (supervisorId) {
        const { data: supervisor } = await client
          .from("profiles")
          .select("email")
          .eq("id", supervisorId)
          .maybeSingle();
        supervisorEmail = (supervisor?.email as string | null) ?? null;
      }
    } catch (error) {
      console.error("[leads] falha ao carregar responsável/supervisor:", error);
    }
  }

  return {
    lead_id: lead.id ?? null,
    lead_codigo: lead.lead_code ?? null,
    cnpj: lead.cnpj ?? null,
    empresa: lead.company ?? null,
    contato: lead.name ?? null,
    telefone: lead.phone ?? null,
    email: lead.email ?? null,
    cidade: lead.city ?? null,
    estado: lead.state ?? null,
    cep: lead.postal_code ?? null,
    origem: lead.source ?? null,
    segmento: lead.segment ?? null,
    valor_estimado: Number(lead.estimated_value ?? 0),
    probabilidade: Number(lead.probability ?? 0),
    responsavel: responsavelNome,
    responsavel_id: ownerId,
    email_responsavel: responsavelEmail,
    email_supervisor: supervisorEmail,
    status: lead.stage ?? null,
    proxima_acao: lead.next_action ?? null,
    proxima_acao_data: lead.next_action_date ?? null,
    previsao_fechamento: lead.expected_close_date ?? null,
    observacoes: lead.notes ?? null,
    criado_em: lead.created_at ?? null,
    atualizado_em: lead.updated_at ?? null,
    ...extra,
  };
}
