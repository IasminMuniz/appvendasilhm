import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { Users, Package, ShoppingCart, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listCustomers } from "@/lib/customers.functions";
import { listProducts } from "@/lib/products.functions";
import { listOrders } from "@/lib/orders.functions";

const dashboardQueryOptions = () =>
  queryOptions({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [customers, products, orders] = await Promise.all([
        listCustomers(),
        listProducts(),
        listOrders(),
      ]);
      return { customers, products, orders };
    },
  });

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQueryOptions()),
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Dashboard - Vendas Comercial" },
      { name: "description", content: "Visão geral do app de vendas comercial." },
    ],
  }),
});

function DashboardPage() {
  const { data } = useSuspenseQuery(dashboardQueryOptions());
  const { customers, products, orders } = data;

  const totalRevenue = orders.reduce((sum, order) => sum + (order.total ?? 0), 0);
  const pendingOrders = orders.filter((o) => o.status === "pendente").length;

  const cards = [
    { title: "Clientes", value: customers.length, icon: Users, href: "/clientes" },
    { title: "Produtos", value: products.length, icon: Package, href: "/produtos" },
    { title: "Pedidos", value: orders.length, icon: ShoppingCart, href: "/pedidos" },
    { title: "Receita total", value: `R$ ${totalRevenue.toFixed(2)}`, icon: TrendingUp, href: "/pedidos" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do seu negócio.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.title} to={card.href}>
            <Card className="transition-colors hover:bg-accent/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <card.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pedidos pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{pendingOrders}</p>
            <p className="text-sm text-muted-foreground">
              {pendingOrders === 1 ? "pedido aguardando ação" : "pedidos aguardando ação"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Últimos pedidos</CardTitle>
          </CardHeader>
          <CardContent>
            {orders.slice(0, 5).map((order) => (
              <div key={order.id} className="flex items-center justify-between border-b py-2 last:border-0">
                <span className="text-sm font-medium">{order.customers?.name ?? "Cliente"}</span>
                <span className="text-sm text-muted-foreground">
                  R$ {(order.total ?? 0).toFixed(2)}
                </span>
              </div>
            ))}
            {orders.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum pedido registrado ainda.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
