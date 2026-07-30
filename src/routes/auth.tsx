import { createFileRoute, redirect } from "@tanstack/react-router";
import { AuthForm } from "@/components/auth/auth-form";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "Entrar - Vendas Comercial" },
      { name: "description", content: "Acesse sua conta no app de vendas comercial." },
      { property: "og:title", content: "Entrar - Vendas Comercial" },
      { property: "og:description", content: "Acesse sua conta no app de vendas comercial." },
    ],
  }),
});

function AuthPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <AuthForm />
    </div>
  );
}
