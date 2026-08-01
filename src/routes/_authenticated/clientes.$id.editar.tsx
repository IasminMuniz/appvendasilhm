import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCustomer, updateCustomer } from "@/lib/customers.functions";
import {
  CustomerFormFields,
  type CustomerFormValues,
  toCustomerPayload,
} from "@/components/customers/customer-form-fields";

const customerQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["customer", id],
    queryFn: () => getCustomer({ data: { id } }),
  });

export const Route = createFileRoute("/_authenticated/clientes/$id/editar")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(customerQueryOptions(params.id)),
  component: EditCustomerPage,
  errorComponent: ({ error }) => (
    <p role="alert" className="text-sm text-destructive">
      {error.message}
    </p>
  ),
  notFoundComponent: () => <p>Cliente não encontrado.</p>,
  head: () => ({
    meta: [
      { title: "Editar Cliente - Vendas Comercial" },
      { name: "description", content: "Atualize o cadastro do cliente na plataforma comercial." },
      { property: "og:title", content: "Editar Cliente - Vendas Comercial" },
      {
        property: "og:description",
        content: "Atualize o cadastro do cliente na plataforma comercial.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function EditCustomerPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: customer } = useSuspenseQuery(customerQueryOptions(id));

  const [form, setForm] = useState<CustomerFormValues>({
    legal_name: customer.legal_name ?? "",
    name: customer.name ?? "",
    company_name: customer.company_name ?? "",
    document: customer.document ?? "",
    segment: customer.segment ?? "",
    contact_name: "",
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    address: customer.address ?? "",
    city: customer.city ?? "",
    state: customer.state ?? "",
    postal_code: customer.postal_code ?? "",
    status: (customer.status as CustomerFormValues["status"]) ?? "prospect",
    notes: customer.notes ?? "",
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: updateCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer", id] });
      queryClient.invalidateQueries({ queryKey: ["customer-detail", id] });
      toast.success("Cliente atualizado.");
      navigate({ to: "/clientes/$id", params: { id } });
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Erro ao atualizar cliente.";
      setError(message);
      toast.error(message);
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" asChild>
        <Link to="/clientes/$id" params={{ id }}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Editar cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              mutation.mutate({ data: { id, ...toCustomerPayload(form) } });
            }}
            className="space-y-4"
          >
            <CustomerFormFields value={form} onChange={setForm} hideContact />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
