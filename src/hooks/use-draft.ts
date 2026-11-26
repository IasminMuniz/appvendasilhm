import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Rascunho automático de cadastros: o que foi digitado fica guardado neste aparelho
 * (localStorage) e volta se a tela fechar, recarregar ou você sair sem salvar.
 */
const PREFIX = "nexus-rascunho:";

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? ((JSON.parse(raw) as { v: T }).v ?? null) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify({ v: value, at: Date.now() }));
  } catch {
    /* sem espaço ou bloqueado: segue sem rascunho */
  }
}

function remove(key: string) {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignora */
  }
}

export function useDraft<T>(
  key: string | null,
  value: T | null,
  options: {
    /** Chamado ao abrir a tela se houver rascunho (telas de cadastro em página própria). */
    onRestore?: (draft: T) => void;
    /** Formulário ainda em branco: não guarda rascunho. */
    isEmpty?: (value: T) => boolean;
  } = {},
) {
  const [ready, setReady] = useState(false);
  const [restored, setRestored] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const stopped = useRef(false);
  const opts = useRef(options);
  opts.current = options;

  // Ao abrir: recupera o rascunho (depois de montar, para não quebrar a renderização no servidor).
  useEffect(() => {
    stopped.current = false;
    setRestored(false);
    if (!key) {
      setHasDraft(false);
      setReady(true);
      return;
    }
    const d = read<T>(key);
    setHasDraft(d != null);
    if (d != null && opts.current.onRestore) {
      opts.current.onRestore(d);
      setRestored(true);
    }
    setReady(true);
  }, [key]);

  // A cada mudança: guarda (valor nulo = formulário fechado, mantém o rascunho que já existe).
  useEffect(() => {
    if (!ready || !key || stopped.current || value == null) return;
    if (opts.current.isEmpty?.(value)) return;
    write(key, value);
    setHasDraft(true);
  }, [ready, key, value]);

  /** Apaga o rascunho (depois de salvar ou ao descartar). */
  const clear = useCallback(() => {
    if (!key) return;
    stopped.current = true;
    remove(key);
    setHasDraft(false);
    setRestored(false);
    // Volta a guardar nas próximas mudanças.
    setTimeout(() => {
      stopped.current = false;
    }, 0);
  }, [key]);

  const readDraft = useCallback(() => (key ? read<T>(key) : null), [key]);

  return { restored, hasDraft, readDraft, clear };
}

/** Apaga um rascunho de fora do formulário (por exemplo, depois que a página salvou). */
export function clearDraft(key: string) {
  remove(key);
}
