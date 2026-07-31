import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCustomers from "./tools/list-customers";
import createCustomer from "./tools/create-customer";
import listProducts from "./tools/list-products";
import listOrders from "./tools/list-orders";
import createOrder from "./tools/create-order";
import updateOrderStatus from "./tools/update-order-status";
import salesSummary from "./tools/sales-summary";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "cloud-journey-begins",
  title: "Cloud Journey Begins",
  version: "0.1.0",
  instructions:
    "Ferramentas do app de vendas comercial. Consulte e gerencie clientes, produtos e pedidos do usuário autenticado. Use list_customers e list_products para obter IDs antes de criar um pedido com create_order.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listCustomers,
    createCustomer,
    listProducts,
    listOrders,
    createOrder,
    updateOrderStatus,
    salesSummary,
  ],
});
