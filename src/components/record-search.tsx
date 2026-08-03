import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** Normaliza texto para comparação (sem acentos, minúsculo). */
function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Mantém apenas letras e números — usado para CNPJ e identificadores. */
function normalizeAlnum(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]/g, "");
}

function matches(fields: Array<string | null | undefined>, query: string) {
  const text = normalizeText(query);
  if (!text) return true;
  const alnum = normalizeAlnum(query);
  return fields.some((field) => {
    if (!field) return false;
    const value = String(field);
    if (normalizeText(value).includes(text)) return true;
    return alnum.length > 0 && normalizeAlnum(value).includes(alnum);
  });
}

/**
 * Filtro de pesquisa em tempo real sobre registros já carregados.
 * Procura por nome/empresa, identificador único e CNPJ.
 */
export function useRecordSearch<T>(
  items: T[],
  getFields: (item: T) => Array<string | null | undefined>,
) {
  const [query, setQuery] = useState("");

  const results = useMemo(
    () => (query.trim() ? items.filter((item) => matches(getFields(item), query)) : items),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, query],
  );

  return { query, setQuery, results, isSearching: query.trim().length > 0 };
}

export type SearchSuggestion = {
  id: string;
  label: string;
  sublabel?: string;
};

type RecordSearchProps = {
  query: string;
  onQueryChange: (value: string) => void;
  suggestions: SearchSuggestion[];
  onSelect?: (id: string) => void;
  placeholder?: string;
  /** Mínimo de caracteres para exibir o autocomplete. */
  minChars?: number;
};

/** Campo "Pesquisar" com autocomplete padrão das listagens. */
export function RecordSearch({
  query,
  onQueryChange,
  suggestions,
  onSelect,
  placeholder = "Pesquisar por nome, ID ou CNPJ",
  minChars = 3,
}: RecordSearchProps) {
  const [focused, setFocused] = useState(false);
  const trimmed = query.trim();
  const showSuggestions =
    focused && trimmed.length >= minChars && suggestions.length > 0 && Boolean(onSelect);

  return (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
        aria-label="Pesquisar"
        className="pl-9 pr-9"
      />
      {trimmed.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
          onClick={() => onQueryChange("")}
          aria-label="Limpar pesquisa"
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      {showSuggestions && (
        <ul className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
          {suggestions.slice(0, 8).map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="w-full rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect?.(s.id);
                  setFocused(false);
                }}
              >
                <span className="block font-medium">{s.label}</span>
                {s.sublabel && (
                  <span className="block text-xs text-muted-foreground">{s.sublabel}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
