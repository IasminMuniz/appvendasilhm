import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createCustomer, addCustomerContact } from "@/lib/customers.functions";
import {
  CustomerFormFields,
  emptyCustomerForm,
  toCustomerPayload,
} from "@/components/customers/customer-form-fields";

export const Route = createFileRoute("/_authenticated/clientes/novo")({
  component: NewCustomerPage,
  head: () => ({
    meta: [
      { title: "Novo Cliente - Nexus 360" },
      { name: "description", content: "Cadastre um novo cliente com dados comerciais completos." },
      { property: "og:title", content: "Novo Cliente - Nexus 360" },
      {
        property: "og:description",
        content: "Cadastre um novo cliente com dados comerciais completos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function NewCustomerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyCustomerForm);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const customer = await createCustomer({ data: toCustomerPayload(form) });
      if (form.contact_name.trim()) {
        await addCustomerContact({
          data: {
            customer_id: customer.id,
            name: form.contact_name,
            email: form.email,
            phone: form.phone,
            is_primary: true,
          },
        });
      }
      return customer;
    },
    onSuccess: (customer) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Cliente cadastrado.");
      navigate({ to: "/clientes/$id", params: { id: customer.id } });
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Erro ao criar cliente.";
      setError(message);
      toast.error(message);
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" asChild>
        <Link to="/clientes">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Novo cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              mutation.mutate();
            }}
            className="space-y-4"
          >
            <CustomerFormFields value={form} onChange={setForm} />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : "Salvar cliente"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
