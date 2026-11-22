import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPackagingCost, savePackagingCost } from "@/lib/store.functions";

export const packagingCostQuery = {
  queryKey: ["packaging-cost"],
  queryFn: () => getPackagingCost(),
};

/** Configuração do custo de embalagem por peça, usado no lucro das novas vendas. */
export function PackagingCostCard() {
  const qc = useQueryClient();
  const { data } = useQuery(packagingCostQuery);
  const [value, setValue] = useState("");
  useEffect(() => {
    if (data) setValue(String(data.value));
  }, [data]);
  const save = useMutation({
    mutationFn: savePackagingCost,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["packaging-cost"] });
      toast.success("Custo de embalagem atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Custo de embalagem por peça</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({ data: { value: Number(value || 0) } });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="pack">Valor (R$)</Label>
            <Input
              id="pack"
              type="number"
              min="0"
              step="0.01"
              className="w-32"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Salvando..." : "Salvar"}
          </Button>
          <p className="w-full text-sm text-muted-foreground">
            Envelope, sacola, tag e afins de cada peça. É descontado no lucro das próximas vendas,
            por isso não lance as embalagens também como despesa.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
