import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COLORS, PATTERNS, SIZES, STYLES, buildSku, calcMargin } from "@/lib/clothing";
import { getNextModelNumber, listSuppliers } from "@/lib/store.functions";

export interface ProductFormValues {
  name: string;
  description: string;
  price: number;
  cost: number;
  stock: number;
  active: boolean;
  supplier: string;
  style: string;
  color: string;
  pattern: string;
  size: string;
  model_number: number | null;
  /** Novo (revenda) ou seminovo (peça própria). */
  condition: "novo" | "seminovo";
  /** Estado da peça seminova: uso, marcas, defeitos. */
  condition_notes: string;
}

export const emptyProduct: ProductFormValues = {
  name: "", description: "", price: 0, cost: 0, stock: 0, active: true,
  supplier: "PML Fashion", style: "", color: "", pattern: "", size: "", model_number: null,
  condition: "novo", condition_notes: "",
};

function Pick({ id, label, value, options, onChange }: {
  id: string; label: string; value: string;
  options: readonly { value: string; label: string }[]; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id={id}><SelectValue placeholder="Selecione" /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

const withCode = (l: readonly { value: string; code: string }[]) =>
  l.map((i) => ({ value: i.value, label: `${i.value} (${i.code})` }));

export const suppliersQueryOptions = { queryKey: ["suppliers"], queryFn: () => listSuppliers() };

export function ProductForm({ initial, submitLabel, pending, error, onSubmit, productId, stockLocked = false }: {
  initial: ProductFormValues; submitLabel: string; pending: boolean; error: string | null;
  onSubmit: (v: ProductFormValues) => void;
  /** Id do produto em edição (para não contar ele mesmo no próximo Modelo nº). */
  productId?: string;
  /** Estoque calculado pelas entradas e saídas (campo bloqueado). */
  stockLocked?: boolean;
}) {
  const { data: supplierRows } = useQuery(suppliersQueryOptions);
  const suppliers = (supplierRows ?? []).map((x) => ({ value: x.name, code: x.code }));
  const [f, setF] = useState({
    ...initial,
    price: String(initial.price ?? 0),
    cost: String(initial.cost ?? 0),
    stock: String(initial.stock ?? 0),
    model_number: initial.model_number == null ? "" : String(initial.model_number),
  });
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));
  // Preenche o Modelo nº sozinho em produtos novos ou quando a combinação muda (editável).
  const autoModel = useRef(initial.model_number == null);
  const setCombo = (patch: Partial<typeof f>) => { autoModel.current = true; set(patch); };
  useEffect(() => {
    if (!autoModel.current || !f.supplier || !f.style || !f.color || !f.pattern) return;
    let cancelled = false;
    getNextModelNumber({ data: { supplier: f.supplier, style: f.style, color: f.color, pattern: f.pattern, excludeId: productId } })
      .then((r) => { if (!cancelled && autoModel.current) set({ model_number: String(r.next) }); })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.supplier, f.style, f.color, f.pattern, productId]);
  const price = Number(f.price || 0);
  const cost = Number(f.cost || 0);
  const model = f.model_number === "" ? null : Number(f.model_number);
  const sku = buildSku({ ...f, model_number: model }, suppliers);
  const margin = calcMargin(price, cost);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ ...f, price, cost, stock: Number(f.stock || 0), model_number: model });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="name">Nome do produto *</Label>
        <Input id="name" required value={f.name} onChange={(e) => set({ name: e.target.value })} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Pick
          id="condition"
          label="Condição"
          value={f.condition}
          options={[
            { value: "novo", label: "Novo" },
            { value: "seminovo", label: "Seminovo" },
          ]}
          onChange={(v) => set({ condition: v as "novo" | "seminovo" })}
        />
        {f.condition === "seminovo" && (
          <div className="space-y-2">
            <Label htmlFor="condition_notes">Estado da peça</Label>
            <Input
              id="condition_notes"
              maxLength={300}
              placeholder="Ex.: usada 2 vezes, sem defeitos"
              value={f.condition_notes}
              onChange={(e) => set({ condition_notes: e.target.value })}
            />
          </div>
        )}
      </div>
      {f.condition === "seminovo" && (
        <p className="text-xs text-muted-foreground">
          Peça própria: deixe o custo em R$ 0 (ou o valor que você pagou) e o estoque em 1.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Pick id="supplier" label="Fornecedor" value={f.supplier} options={withCode(suppliers)} onChange={(v) => setCombo({ supplier: v })} />
        <Pick id="style" label="Estilo" value={f.style} options={withCode(STYLES)} onChange={(v) => setCombo({ style: v })} />
        <Pick id="color" label="Cor" value={f.color} options={withCode(COLORS)} onChange={(v) => setCombo({ color: v })} />
        <Pick id="pattern" label="Padrão" value={f.pattern} options={withCode(PATTERNS)} onChange={(v) => setCombo({ pattern: v })} />
        <Pick id="size" label="Tamanho" value={f.size} options={SIZES.map((s) => ({ value: s, label: s }))} onChange={(v) => set({ size: v })} />
        <div className="space-y-2">
          <Label htmlFor="model">Modelo nº</Label>
          <Input id="model" type="number" min="0" max="99" value={f.model_number} onChange={(e) => { autoModel.current = false; set({ model_number: e.target.value }); }} />
          <p className="text-xs text-muted-foreground">Preenchido sozinho com o próximo número livre para peças com o mesmo fornecedor, estilo, cor e padrão.</p>
        </div>
      </div>

      <div className="rounded-md border bg-muted/40 p-3">
        <p className="text-xs text-muted-foreground">SKU gerado automaticamente</p>
        <p className="font-mono text-lg font-semibold">{sku ?? "Preencha fornecedor, estilo, cor, padrão, modelo e tamanho"}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="cost">Custo (R$)</Label>
          <Input id="cost" type="number" min="0" step="0.01" value={f.cost} onChange={(e) => set({ cost: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="price">Preço de venda (R$)</Label>
          <Input id="price" type="number" min="0" step="0.01" value={f.price} onChange={(e) => set({ price: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Margem</Label>
          <p className={`flex h-9 items-center text-lg font-semibold ${margin < 0 ? "text-destructive" : ""}`}>
            {margin.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="stock">Estoque</Label>
        <Input
          id="stock"
          type="number"
          min="0"
          value={f.stock}
          disabled={stockLocked}
          onChange={(e) => set({ stock: e.target.value })}
        />
        {stockLocked && (
          <p className="text-xs text-muted-foreground">
            Calculado sozinho: compras recebidas − vendas. Para mudar, ajuste a compra ou a venda.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Observações</Label>
        <Input id="description" value={f.description} onChange={(e) => set({ description: e.target.value })} />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="active" checked={f.active} onCheckedChange={(c) => set({ active: c === true })} />
        <Label htmlFor="active" className="font-normal">Produto ativo</Label>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Salvando..." : submitLabel}</Button>
    </form>
  );
}
