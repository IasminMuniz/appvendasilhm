import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { listIntegrations, upsertIntegration } from "@/lib/integrations.functions";

const CATALOG = [
  { category: "erp", provider: "erp_generico", label: "ERP", description: "Sincronização de pedidos e faturamento." },
  { category: "email", provider: "lovable_email", label: "E-mail", description: "Envio de orçamentos e comunicações." },
  { category: "whatsapp", provider: "whatsapp_business", label: "WhatsApp", description: "Mensagens comerciais para clientes." },
  { category: "pagamentos", provider: "gateway_pagamentos", label: "Pagamentos", description: "Cobranças e links de pagamento." },
  { category: "bi", provider: "bi_export", label: "BI", description: "Exportação de dados para análise externa." },
];

const integrationsQueryOptions = () =>
  queryOptions({ queryKey: ["integrations"], queryFn: () => listIntegrations() });

export const Route = createFileRoute("/_authenticated/integracoes")({
  loader: ({ context }) => context.queryClient.ensureQueryData(integrationsQueryOptions()),
  component: IntegrationsPage,
  head: () => ({
    meta: [
      { title: "Integrações - Plataforma Comercial" },
      {
        name: "description",
        content: "Ative integrações de ERP, e-mail, WhatsApp, pagamentos e BI.",
      },
    ],
  }),
});

function IntegrationsPage() {
  const queryClient = useQueryClient();
  const { data: integrations } = useSuspenseQuery(integrationsQueryOptions());

  const mutation = useMutation({
    mutationFn: upsertIntegration,
    onSuccess: () => {
      toast.success("Integração atualizada");
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integrações</h1>
        <p className="text-muted-foreground">
          Estrutura preparada para conectar sistemas externos à plataforma.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {CATALOG.map((item) => {
          const current = integrations.find(
            (i) => i.category === item.category && i.provider === item.provider,
          );
          const enabled = current?.enabled ?? false;
          return (
            <Card key={item.provider}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{item.label}</CardTitle>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={(checked) =>
                    mutation.mutate({
                      data: {
                        category: item.category,
                        provider: item.provider,
                        enabled: checked,
                        config: {},
                      },
                    })
                  }
                />
              </CardHeader>
              <CardContent>
                <Badge variant={enabled ? "default" : "outline"}>
                  {enabled ? "Ativo" : "Inativo"}
                </Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
