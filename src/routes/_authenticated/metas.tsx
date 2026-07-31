import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createGoal, deleteGoal, getDashboard, listGoals } from "@/lib/dashboard.functions";
import { formatCurrency } from "@/lib/commercial-constants";

const goalsQueryOptions = () =>
  queryOptions({
    queryKey: ["goals"],
    queryFn: async () => {
      const [goals, dashboard] = await Promise.all([listGoals(), getDashboard()]);
      return { ...goals, progress: dashboard.goalProgress };
    },
  });

export const Route = createFileRoute("/_authenticated/metas")({
  loader: ({ context }) => context.queryClient.ensureQueryData(goalsQueryOptions()),
  component: GoalsPage,
  head: () => ({
    meta: [
      { title: "Metas - Plataforma Comercial" },
      {
        name: "description",
        content: "Defina metas por vendedor e período e acompanhe o percentual atingido.",
      },
    ],
  }),
});

function GoalsPage() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(goalsQueryOptions());
  const [form, setForm] = useState({
    user_id: "",
    target_amount: 0,
    period_start: "",
    period_end: "",
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["goals"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const createMutation = useMutation({
    mutationFn: createGoal,
    onSuccess: () => {
      toast.success("Meta criada");
      setForm({ user_id: "", target_amount: 0, period_start: "", period_end: "" });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGoal,
    onSuccess: () => {
      toast.success("Meta removida");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nameOf = (userId: string | null) =>
    userId
      ? (data.profiles.find((p) => p.id === userId)?.full_name ??
        data.profiles.find((p) => p.id === userId)?.email ??
        "Usuário")
      : "Equipe";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Metas</h1>
        <p className="text-muted-foreground">Metas por vendedor e equipe com acompanhamento.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nova meta</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate({ data: form });
            }}
          >
            <div className="space-y-2">
              <Label>Vendedor</Label>
              <Select
                value={form.user_id || "equipe"}
                onValueChange={(value) =>
                  setForm({ ...form, user_id: value === "equipe" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equipe">Equipe (todos)</SelectItem>
                  {data.profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name || p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="target">Meta (R$)</Label>
              <Input
                id="target"
                type="number"
                min={0}
                step="0.01"
                value={form.target_amount}
                onChange={(e) => setForm({ ...form, target_amount: Number(e.target.value) })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start">Início</Label>
              <Input
                id="start"
                type="date"
                value={form.period_start}
                onChange={(e) => setForm({ ...form, period_start: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">Fim</Label>
              <Input
                id="end"
                type="date"
                value={form.period_end}
                onChange={(e) => setForm({ ...form, period_end: e.target.value })}
                required
              />
            </div>
            <Button type="submit" className="sm:col-span-4" disabled={createMutation.isPending}>
              Criar meta
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Acompanhamento do período atual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.progress.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma meta ativa no período.</p>
          ) : (
            data.progress.map((g) => (
              <div key={g.id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{g.owner}</span>
                  <span>
                    {formatCurrency(g.achieved)} / {formatCurrency(g.target)} (
                    {g.percent.toFixed(0)}%)
                  </span>
                </div>
                <Progress value={Math.min(100, g.percent)} />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Todas as metas</CardTitle>
        </CardHeader>
        <CardContent>
          {data.goals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada.</p>
          ) : (
            <div className="divide-y">
              {data.goals.map((goal) => (
                <div key={goal.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{nameOf(goal.user_id)}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(goal.period_start).toLocaleDateString("pt-BR")} —{" "}
                      {new Date(goal.period_end).toLocaleDateString("pt-BR")} ·{" "}
                      {formatCurrency(Number(goal.target_amount))}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate({ data: { id: goal.id } })}
                  >
                    Remover
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
