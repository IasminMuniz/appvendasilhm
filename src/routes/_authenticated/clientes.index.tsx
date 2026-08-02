import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteCustomer, listCustomers } from "@/lib/customers.functions";
import { LocationAnalytics } from "@/components/analytics/location-analytics";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkDeleteBar, bulkDeleteToastMessage, useBulkSelection } from "@/components/bulk-select";
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

  const remove = useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Cliente excluído.");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Erro ao excluir cliente."),
  });

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
        <CardHeader>
          <CardTitle>Lista de clientes</CardTitle>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum cliente cadastrado.</p>
          ) : (
            <div className="divide-y">
              {customers.map((customer) => (
                <div key={customer.id} className="flex items-center justify-between gap-3 py-3">
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
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" asChild aria-label="Editar cliente">
                      <Link to="/clientes/$id/editar" params={{ id: customer.id }}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Excluir cliente"
                          disabled={remove.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir {customer.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O cadastro, contatos, interações e histórico serão removidos
                            permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => remove.mutate({ data: { id: customer.id } })}
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
