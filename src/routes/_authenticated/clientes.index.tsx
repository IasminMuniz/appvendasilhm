import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";
import { listCustomers } from "@/lib/customers.functions";
import { LocationAnalytics } from "@/components/analytics/location-analytics";
import { Checkbox } from "@/components/ui/checkbox";
import { OptionsMenu, bulkDeleteToastMessage, useBulkSelection } from "@/components/bulk-select";
import { bulkDeleteCustomers } from "@/lib/bulk-delete.functions";

const customersQueryOptions = () =>
  queryOptions({
    queryKey: ["customers"],
    queryFn: () => listCustomers(),
  });

export const Route = createFileRoute("/_authenticated/clientes/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(customersQueryOptions()),
  component: CustomersPage,
  errorComponent: ({ error }) => (
    <p role="alert" className="text-sm text-destructive">
      {error.message}
    </p>
  ),
  notFoundComponent: () => <p>Nenhum cliente encontrado.</p>,
  head: () => ({
    meta: [{ title: "Clientes - Vendas Comercial" }],
  }),
});

function CustomersPage() {
  const { data: customers } = useSuspenseQuery(customersQueryOptions());
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const selection = useBulkSelection(customers.map((c) => c.id));

  const removeMany = useMutation({
    mutationFn: bulkDeleteCustomers,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      selection.clear();
      toast.success(bulkDeleteToastMessage(result));
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Erro ao excluir clientes."),
  });

  const handleEdit = () => {
    if (selection.selected.length === 1) {
      navigate({ to: "/clientes/$id/editar", params: { id: selection.selected[0]! } });
      return;
    }
    toast.info("Selecione apenas um cliente para abrir o formulário de edição.");
  };

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

      <LocationAnalytics show={["customersByCity", "conversionByRegion"]} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle>Lista de clientes</CardTitle>
          <OptionsMenu
            total={customers.length}
            count={selection.selected.length}
            onSelectAll={selection.selectAll}
            onClearAll={selection.clear}
            onEdit={handleEdit}
            onDelete={() => removeMany.mutate({ data: { ids: selection.selected } })}
            isPending={removeMany.isPending}
            entityLabel="cliente(s)"
            description="Cadastros, contatos, interações e histórico dos clientes selecionados serão removidos permanentemente."
          />
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum cliente cadastrado.</p>
          ) : (
            <div className="divide-y">
              {customers.map((customer) => (
                <div key={customer.id} className="flex items-center justify-between gap-3 py-3">
                  <Checkbox
                    checked={selection.isSelected(customer.id)}
                    onCheckedChange={() => selection.toggle(customer.id)}
                    aria-label={`Selecionar ${customer.name}`}
                  />
                  <button
                    type="button"
                    className="flex-1 text-left hover:opacity-80"
                    onClick={() => navigate({ to: "/clientes/$id", params: { id: customer.id } })}
                  >
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {customer.email || customer.phone || "Sem contato"}
                    </p>
                    {(customer.city || customer.state) && (
                      <p className="text-xs text-muted-foreground">
                        {[customer.city, customer.state].filter(Boolean).join(" / ")}
                        {customer.postal_code ? ` · CEP ${customer.postal_code}` : ""}
                      </p>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
