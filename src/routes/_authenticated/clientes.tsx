import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listCustomers } from "@/lib/customers.functions";

const customersQueryOptions = () =>
  queryOptions({
    queryKey: ["customers"],
    queryFn: () => listCustomers(),
  });

export const Route = createFileRoute("/_authenticated/clientes")({
  loader: ({ context }) => context.queryClient.ensureQueryData(customersQueryOptions()),
  component: CustomersPage,
  head: () => ({
    meta: [{ title: "Clientes - Vendas Comercial" }],
  }),
});

function CustomersPage() {
  const { data: customers } = useSuspenseQuery(customersQueryOptions());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">Gerencie sua base de clientes.</p>
        </div>
        <Button asChild>
          <Link to="/clientes/novo">
            <Plus className="mr-2 h-4 w-4" />
            Novo cliente
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de clientes</CardTitle>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum cliente cadastrado.</p>
          ) : (
            <div className="divide-y">
              {customers.map((customer) => (
                <Link
                  key={customer.id}
                  to="/clientes/$id"
                  params={{ id: customer.id }}
                  className="flex items-center justify-between py-3 hover:opacity-80"
                >
                  <div>
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {customer.email || customer.phone || "Sem contato"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
