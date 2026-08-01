import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createUser,
  getAccessProfile,
  listUsers,
  runInactiveCustomersCheck,
  setUserRole,
  setUserSupervisor,
} from "@/lib/admin.functions";
import { ROLE_LABELS } from "@/lib/commercial-constants";

const usersQueryOptions = () =>
  queryOptions({
    queryKey: ["users"],
    queryFn: async () => {
      const [users, me] = await Promise.all([listUsers(), getAccessProfile()]);
      return { users, me };
    },
  });

export const Route = createFileRoute("/_authenticated/usuarios")({
  loader: ({ context }) => context.queryClient.ensureQueryData(usersQueryOptions()),
  component: UsersPage,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive">Não foi possível carregar os usuários: {error.message}</p>
  ),
  notFoundComponent: () => <p className="text-sm text-muted-foreground">Página não encontrada.</p>,
  head: () => ({
    meta: [
      { title: "Usuários e permissões - Nexus 360" },
      {
        name: "description",
        content: "Gerencie perfis de acesso, responsáveis comerciais e permissões dos usuários.",
      },
      { property: "og:title", content: "Usuários e permissões - Nexus 360" },
      {
        property: "og:description",
        content: "Controle de acesso por perfil: administrador, gestor, supervisor e vendedor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const ROLES = ["admin", "gerente", "supervisor", "vendedor"] as const;

function UsersPage() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(usersQueryOptions());
  const isAdmin = data.me.isAdmin;

  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "vendedor",
    supervisor_id: "",
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  const roleMutation = useMutation({
    mutationFn: (vars: { user_id: string; role: string }) => setUserRole({ data: vars }),
    onSuccess: () => {
      toast.success("Perfil de acesso atualizado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const supervisorMutation = useMutation({
    mutationFn: (vars: { user_id: string; supervisor_id?: string }) =>
      setUserSupervisor({ data: vars }),
    onSuccess: () => {
      toast.success("Responsável comercial atualizado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createMutation = useMutation({
    mutationFn: () => createUser({ data: form }),
    onSuccess: () => {
      toast.success("Usuário criado");
      setForm({ email: "", password: "", full_name: "", role: "vendedor", supervisor_id: "" });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const inactiveMutation = useMutation({
    mutationFn: () => runInactiveCustomersCheck({ data: { days: 90 } }),
    onSuccess: (res) => toast.success(`${res.created} evento(s) de cliente inativo gerados`),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Usuários e permissões</h1>
        <p className="text-muted-foreground">
          Perfis de acesso e vínculo de cada vendedor com seu responsável comercial.
        </p>
      </div>

      {!isAdmin && (
        <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          Você está visualizando apenas os usuários da sua hierarquia. Alterações de perfil e
          responsável são exclusivas do administrador.
        </p>
      )}

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Novo usuário</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nome</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Perfil</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Responsável comercial</Label>
              <Select
                value={form.supervisor_id || "none"}
                onValueChange={(v) => setForm({ ...form, supervisor_id: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {data.users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-5">
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
              >
                Criar usuário
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Usuários</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.users.map((u) => (
            <div
              key={u.id}
              className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="font-medium">{u.full_name || u.email}</p>
                <p className="text-sm text-muted-foreground">{u.email}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {u.roles.length ? (
                    u.roles.map((r) => (
                      <Badge key={r} variant="secondary">
                        {ROLE_LABELS[r] ?? r}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="outline">Sem perfil</Badge>
                  )}
                  {u.supervisor_name && (
                    <Badge variant="outline">Responsável: {u.supervisor_name}</Badge>
                  )}
                </div>
              </div>

              {isAdmin && (
                <div className="flex flex-col gap-2 md:flex-row">
                  <Select
                    value={u.roles[0] ?? ""}
                    onValueChange={(v) => roleMutation.mutate({ user_id: u.id, role: v })}
                  >
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder="Perfil de acesso" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={u.supervisor_id ?? "none"}
                    onValueChange={(v) =>
                      supervisorMutation.mutate({
                        user_id: u.id,
                        supervisor_id: v === "none" ? "" : v,
                      })
                    }
                  >
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder="Responsável comercial" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem responsável</SelectItem>
                      {data.users
                        .filter((o) => o.id !== u.id)
                        .map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.full_name || o.email}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Rotinas do sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => inactiveMutation.mutate()}
              disabled={inactiveMutation.isPending}
            >
              Verificar clientes inativos (90 dias)
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
