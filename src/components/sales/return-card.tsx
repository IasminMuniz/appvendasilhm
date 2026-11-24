import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { registerOrderReturn } from "@/lib/orders.functions";
import { RETURN_REASONS, RETURN_TYPES, returnTypeLabel } from "@/lib/returns";

interface ReturnInfo {
  id: string;
  status: string | null;
  return_type?: string | null;
  return_reason?: string | null;
  return_notes?: string | null;
  returned_at?: string | null;
}

/** Troca ou devolução da venda: registra o motivo e cancela a venda (estoque volta). */
export function OrderReturnCard({ order }: { order: ReturnInfo }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"devolucao" | "troca">("devolucao");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const save = useMutation({
    mutationFn: () =>
      registerOrderReturn({
        data: { id: order.id, return_type: type, return_reason: reason, return_notes: notes },
      }),
    onSuccess: () => {
      toast.success(type === "troca" ? "Troca registrada" : "Devolução registrada");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["order", order.id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["store-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const label = returnTypeLabel(order.return_type);
  if (label) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Undo2 className="h-4 w-4" />
            Venda {label.toLowerCase()}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Motivo:</span> {order.return_reason}
          </p>
          {order.return_notes && <p className="text-muted-foreground">{order.return_notes}</p>}
          {order.returned_at && (
            <p className="text-xs text-muted-foreground">
              Registrada em {new Date(order.returned_at).toLocaleDateString("pt-BR")}
            </p>
          )}
          {order.return_type === "troca" && (
            <Button variant="outline" size="sm" className="mt-2" asChild>
              <Link to="/pedidos/novo">Lançar a venda da peça nova</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }
  if (order.status === "cancelado") return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Undo2 className="mr-2 h-4 w-4" />
          Registrar troca ou devolução
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Troca ou devolução</DialogTitle>
          <DialogDescription>
            A venda é cancelada: a peça volta para o estoque e o valor sai do faturamento, do lucro
            e do caixa. Na troca, lance a peça nova como uma venda nova.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="flex gap-2">
              {RETURN_TYPES.map((t) => (
                <Button
                  key={t.value}
                  type="button"
                  size="sm"
                  variant={type === t.value ? "default" : "outline"}
                  onClick={() => setType(t.value)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="return-reason">Motivo</Label>
            <Select value={reason || undefined} onValueChange={setReason}>
              <SelectTrigger id="return-reason">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {RETURN_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="return-notes">Observação (opcional)</Label>
            <Textarea
              id="return-notes"
              rows={3}
              maxLength={500}
              placeholder="Ex.: trocou do M para o G; estorno feito no Nubank em 26/11"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {type === "devolucao" && (
            <p className="text-xs text-muted-foreground">
              Lembre de devolver o dinheiro pela mesma forma de pagamento (Pix por Pix, cartão por
              estorno). A taxa do cartão normalmente não volta: lance-a em Despesas se quiser
              registrar a perda.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button disabled={!reason || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Salvando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
