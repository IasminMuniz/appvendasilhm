import { useCallback, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

/** Controle de seleção múltipla para listas com exclusão em massa. */
export function useBulkSelection(ids: string[]) {
  const [selected, setSelected] = useState<string[]>([]);

  const visible = useMemo(() => selected.filter((id) => ids.includes(id)), [selected, ids]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => (ids.every((id) => prev.includes(id)) && ids.length > 0 ? [] : ids));
  }, [ids]);

  const clear = useCallback(() => setSelected([]), []);

  return {
    selected: visible,
    isSelected: (id: string) => visible.includes(id),
    toggle,
    toggleAll,
    clear,
    allSelected: ids.length > 0 && ids.every((id) => visible.includes(id)),
  };
}

type BulkDeleteBarProps = {
  total: number;
  count: number;
  allSelected: boolean;
  onToggleAll: () => void;
  onDelete: () => void;
  isPending?: boolean;
  entityLabel: string;
  description?: string;
};

/** Barra com "selecionar todos" e botão de exclusão em massa com confirmação. */
export function BulkDeleteBar({
  total,
  count,
  allSelected,
  onToggleAll,
  onDelete,
  isPending,
  entityLabel,
  description,
}: BulkDeleteBarProps) {
  if (total === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2">
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox checked={allSelected} onCheckedChange={onToggleAll} aria-label="Selecionar todos" />
        <span>
          {count > 0 ? `${count} selecionado(s)` : `Selecionar todos (${total})`}
        </span>
      </label>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" disabled={count === 0 || isPending}>
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir selecionados
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {count} {entityLabel}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {description ??
                "Os registros selecionados serão removidos permanentemente. Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Mensagem padrão após uma exclusão em massa. */
export function bulkDeleteToastMessage(result: { deleted: number; skipped: number }) {
  return result.skipped > 0
    ? `${result.deleted} excluído(s). ${result.skipped} ignorado(s) por falta de permissão.`
    : `${result.deleted} registro(s) excluído(s).`;
}
