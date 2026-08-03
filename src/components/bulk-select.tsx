import { useCallback, useMemo, useState } from "react";
import { CheckSquare, ChevronDown, Pencil, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Controle de seleção múltipla para listas com ações em massa. */
export function useBulkSelection(ids: string[]) {
  const [selected, setSelected] = useState<string[]>([]);

  const visible = useMemo(() => selected.filter((id) => ids.includes(id)), [selected, ids]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => (ids.every((id) => prev.includes(id)) && ids.length > 0 ? [] : ids));
  }, [ids]);

  const selectAll = useCallback(() => setSelected(ids), [ids]);

  const clear = useCallback(() => setSelected([]), []);

  return {
    selected: visible,
    isSelected: (id: string) => visible.includes(id),
    toggle,
    toggleAll,
    selectAll,
    clear,
    allSelected: ids.length > 0 && ids.every((id) => visible.includes(id)),
  };
}

type OptionsMenuProps = {
  total: number;
  count: number;
  onSelectAll: () => void;
  onClearAll: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isPending?: boolean;
  entityLabel: string;
  description?: string;
};

/** Menu padrão "Opções" com seleção, edição e exclusão em massa. */
export function OptionsMenu({
  total,
  count,
  onSelectAll,
  onClearAll,
  onEdit,
  onDelete,
  isPending,
  entityLabel,
  description,
}: OptionsMenuProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        {count > 0 ? `${count} de ${total} selecionado(s)` : `${total} registro(s)`}
      </p>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={isPending}>
            Opções
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Ações</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onSelectAll} disabled={total === 0}>
            <CheckSquare className="mr-2 h-4 w-4" />
            Selecionar todos
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onClearAll} disabled={count === 0}>
            <Square className="mr-2 h-4 w-4" />
            Desmarcar todos
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onEdit} disabled={count === 0}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar selecionados
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setConfirmOpen(true)}
            disabled={count === 0}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir selecionados
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
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
            <AlertDialogAction onClick={onDelete}>Excluir {count}</AlertDialogAction>
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
