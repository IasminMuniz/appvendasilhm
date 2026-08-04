import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
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
import {
  INTERACTION_KINDS,
  INTERACTION_LABELS,
  LEAD_STAGES,
} from "@/lib/commercial-constants";
import {
  addLeadInteraction,
  getLeadFollowUp,
  reassignLead,
  setLeadNextAction,
} from "@/lib/leads.functions";

const stageLabel = (value: string | null | undefined) =>
  LEAD_STAGES.find((s) => s.value === value)?.label ?? value ?? "-";

const formatDateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString("pt-BR") : "-";

export function LeadFollowUp({ leadId, leadName }: { leadId: string; leadName: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string>("nota");
  const [content, setContent] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");
  const queryClient = useQueryClient();

  const followUp = useQuery({
    queryKey: ["leads", leadId, "follow-up"],
    queryFn: () => getLeadFollowUp({ data: { id: leadId } }),
    enabled: open,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["leads"] });
  };

  const interactionMutation = useMutation({
    mutationFn: addLeadInteraction,
    onSuccess: () => {
      toast.success("Interação registrada");
      setContent("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ownerMutation = useMutation({
    mutationFn: reassignLead,
    onSuccess: () => {
      toast.success("Responsável atualizado");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nextActionMutation = useMutation({
    mutationFn: setLeadNextAction,
    onSuccess: () => {
      toast.success("Próxima ação agendada");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lead = followUp.data?.lead;
  const owners = followUp.data?.owners ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) {
          setNextAction("");
          setNextActionDate("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 w-full text-xs">
          <History className="mr-1 h-3 w-3" />
          Acompanhamento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Acompanhamento · {leadName}</DialogTitle>
        </DialogHeader>

        {followUp.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

        {lead && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{stageLabel(lead.stage)}</Badge>
              <span>Última interação: {formatDateTime(lead.last_activity_at)}</span>
            </div>

            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!content.trim()) return;
                interactionMutation.mutate({
                  data: { lead_id: leadId, kind, content: content.trim() },
                });
              }}
            >
              <Label>Registrar interação / observação</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERACTION_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {INTERACTION_LABELS[k] ?? k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                value={content}
                placeholder="O que foi tratado com o lead?"
                onChange={(e) => setContent(e.target.value)}
              />
              <Button
                type="submit"
                size="sm"
                disabled={!content.trim() || interactionMutation.isPending}
              >
                {interactionMutation.isPending ? "Salvando..." : "Registrar"}
              </Button>
            </form>

            <Separator />

            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select
                value={lead.owner_id ?? undefined}
                onValueChange={(value) =>
                  ownerMutation.mutate({ data: { id: leadId, owner_id: value } })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o responsável" />
                </SelectTrigger>
                <SelectContent>
                  {owners.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.full_name || o.email || o.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                nextActionMutation.mutate({
                  data: {
                    id: leadId,
                    next_action: nextAction,
                    next_action_date: nextActionDate,
                  },
                });
              }}
            >
              <Label>Próxima ação</Label>
              <Input
                value={nextAction}
                placeholder={lead.next_action ?? "Ex.: enviar proposta"}
                onChange={(e) => setNextAction(e.target.value)}
              />
              <Input
                type="date"
                value={nextActionDate}
                onChange={(e) => setNextActionDate(e.target.value)}
              />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={!nextAction.trim() || nextActionMutation.isPending}
              >
                {nextActionMutation.isPending ? "Salvando..." : "Agendar follow-up"}
              </Button>
            </form>

            <Separator />

            <div className="space-y-2">
              <Label>Linha do tempo</Label>
              <div className="space-y-2">
                {(followUp.data?.interactions ?? []).map((i) => (
                  <div key={i.id} className="rounded-md border p-2 text-xs">
                    <p className="font-medium">
                      {INTERACTION_LABELS[i.kind] ?? i.kind} · {formatDateTime(i.created_at)}
                    </p>
                    <p className="text-muted-foreground">{i.content}</p>
                  </div>
                ))}
                {(followUp.data?.history ?? []).map((h) => (
                  <div key={h.id} className="rounded-md border border-dashed p-2 text-xs">
                    <p className="font-medium">
                      {stageLabel(h.from_stage)} → {stageLabel(h.to_stage)} ·{" "}
                      {formatDateTime(h.created_at)}
                    </p>
                    {h.note && <p className="text-muted-foreground">{h.note}</p>}
                  </div>
                ))}
                {!followUp.data?.interactions.length && !followUp.data?.history.length && (
                  <p className="text-xs text-muted-foreground">Nenhum registro ainda.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
