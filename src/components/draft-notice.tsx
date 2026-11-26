import { FileClock } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Aviso de rascunho recuperado, com opção de descartar e começar do zero. */
export function DraftNotice({
  onDiscard,
  text = "Rascunho recuperado: continue de onde parou.",
}: {
  onDiscard: () => void;
  text?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
      <span className="flex items-center gap-2">
        <FileClock className="h-4 w-4 shrink-0" />
        {text}
      </span>
      <Button type="button" size="sm" variant="ghost" onClick={onDiscard}>
        Descartar
      </Button>
    </div>
  );
}

/** Aviso na página quando há um cadastro começado e não salvo (formulários em janela). */
export function PendingDraftBanner({
  label,
  onContinue,
  onDiscard,
}: {
  label: string;
  onContinue: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
      <span className="flex items-center gap-2">
        <FileClock className="h-4 w-4 shrink-0" />
        Você tem {label} começado e não salvo.
      </span>
      <span className="flex gap-2">
        <Button type="button" size="sm" onClick={onContinue}>
          Continuar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDiscard}>
          Descartar
        </Button>
      </span>
    </div>
  );
}
