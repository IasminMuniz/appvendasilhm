import { useState } from "react";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCashPlan, getPackagingItems, savePackagingItems } from "@/lib/store.functions";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/commercial-constants";
import {
  CHANNELS,
  DELIVERY_METHODS,
  OTHER_COST_TYPES,
  SALE_PAYMENT_METHODS,
  DEFAULT_PACKAGING_ITEMS,
  calcSale,
  type PackagingItem,
  type SaleItem,
} from "@/lib/sales";

export interface SaleInfoValues {
  channel: string;
  payment_method: string;
  delivery_method: string;
  other_costs: string;
  other_cost_type: string;
  /** Usar embalagem nesta venda? Desligado por padrão. */
  include_packaging: boolean;
  /** Valor gasto com embalagem nesta venda (R$), só quando marcado. */
  packaging_value: string;
  /** Sacolas marcadas nesta venda (só na tela; somam no valor da embalagem). */
  packaging_items?: string[];
}

export const emptySaleInfo: SaleInfoValues = {
  channel: "",
  payment_method: "",
  delivery_method: "",
  other_costs: "0",
  other_cost_type: "",
  include_packaging: false,
  packaging_value: "",
  packaging_items: [],
};

export const packagingItemsQuery = queryOptions({
  queryKey: ["packaging-items"],
  queryFn: () => getPackagingItems(),
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const sumOf = (items: PackagingItem[], ids: string[]) =>
  Math.round(items.filter((i) => ids.includes(i.id)).reduce((t, i) => t + i.price, 0) * 100) / 100;

/** Sacolas da venda: marcar soma o valor de cada uma no total de embalagem. */
function PackagingPicker({
  value,
  onChange,
}: {
  value: SaleInfoValues;
  onChange: (patch: Partial<SaleInfoValues>) => void;
}) {
  const qc = useQueryClient();
  const { data } = useQuery(packagingItemsQuery);
  const items = data ?? DEFAULT_PACKAGING_ITEMS;
  const selected = value.packaging_items ?? [];
  const [editing, setEditing] = useState(false);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: savePackagingItems,
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["packaging-items"] });
      // Atualiza o total desta venda com os novos valores.
      if (selected.length)
        onChange({
          packaging_value: String(sumOf((vars?.data ?? items) as PackagingItem[], selected)),
        });
      setEditing(false);
      toast.success("Valores das embalagens salvos.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (id: string, on: boolean) => {
    const next = on ? [...selected, id] : selected.filter((x) => x !== id);
    onChange({
      packaging_items: next,
      packaging_value: next.length ? String(sumOf(items, next)) : "",
    });
  };

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Quais embalagens usou?</p>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={() => {
            setPrices(Object.fromEntries(items.map((i) => [i.id, String(i.price)])));
            setEditing((e) => !e);
          }}
        >
          {editing ? "Fechar" : "Alterar valores"}
        </Button>
      </div>
      {editing ? (
        <div className="space-y-2">
          {items.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-3">
              <Label htmlFor={`price_${i.id}`} className="font-normal">
                {i.name}
              </Label>
              <Input
                id={`price_${i.id}`}
                type="number"
                min="0"
                step="0.01"
                className="w-28"
                value={prices[i.id] ?? ""}
                onChange={(e) => setPrices({ ...prices, [i.id]: e.target.value })}
              />
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            disabled={save.isPending}
            onClick={() =>
              save.mutate({
                data: items.map((i) => ({ ...i, price: Number(prices[i.id] || 0) })),
              })
            }
          >
            {save.isPending ? "Salvando..." : "Salvar valores"}
          </Button>
        </div>
      ) : (
        <>
          {items.map((i) => (
            <label key={i.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2">
                <Checkbox
                  checked={selected.includes(i.id)}
                  onCheckedChange={(c) => toggle(i.id, c === true)}
                />
                {i.name}
              </span>
              <span className={i.price > 0 ? "" : "text-muted-foreground"}>
                {i.price > 0 ? brl(i.price) : "defina o valor"}
              </span>
            </label>
          ))}
          {items.some((i) => i.price <= 0) && (
            <p className="text-xs text-muted-foreground">
              Clique em "Alterar valores" para informar quanto custa cada sacola. Os valores ficam
              salvos para as próximas vendas.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Pick({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function SaleFields({
  value,
  onChange,
}: {
  value: SaleInfoValues;
  onChange: (v: SaleInfoValues) => void;
}) {
  const set = (patch: Partial<SaleInfoValues>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Pick
        id="channel"
        label="Canal"
        value={value.channel}
        options={CHANNELS}
        onChange={(v) => set({ channel: v })}
      />
      <Pick
        id="payment"
        label="Forma de pagamento"
        value={value.payment_method}
        options={SALE_PAYMENT_METHODS}
        onChange={(v) => set({ payment_method: v })}
      />
      <Pick
        id="delivery"
        label="Entrega"
        value={value.delivery_method}
        options={DELIVERY_METHODS}
        onChange={(v) => set({ delivery_method: v })}
      />
      <div />
      <div className="space-y-2">
        <Label htmlFor="other_costs">Outros custos (R$)</Label>
        <Input
          id="other_costs"
          type="number"
          min="0"
          step="0.01"
          value={value.other_costs}
          onChange={(e) => set({ other_costs: e.target.value })}
        />
      </div>
      <Pick
        id="other_cost_type"
        label="Tipo de custo"
        value={value.other_cost_type}
        options={OTHER_COST_TYPES}
        onChange={(v) => set({ other_cost_type: v })}
      />
      <div className="space-y-2 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={value.include_packaging}
            onCheckedChange={(c) => set({ include_packaging: c === true })}
          />
          Usei embalagem nesta venda (sacolas, envelope, tag)
        </label>
        {value.include_packaging && <PackagingPicker value={value} onChange={set} />}
        {value.include_packaging && (
          <div className="max-w-xs space-y-1">
            <Label htmlFor="packaging_value">Quanto gastou de embalagem nesta venda (R$)</Label>
            <Input
              id="packaging_value"
              type="number"
              min="0"
              step="0.01"
              placeholder="Soma das sacolas marcadas"
              value={value.packaging_value}
              onChange={(e) => set({ packaging_value: e.target.value })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export const cashPlanQuery = queryOptions({
  queryKey: ["cash-plan"],
  queryFn: () => getCashPlan(),
});

export function SaleSummary({
  items,
  channel,
  otherCosts,
  productCost,
  packagingCost,
}: {
  items: SaleItem[];
  channel: string | null | undefined;
  otherCosts: number;
  productCost: number;
  /** Custo de embalagem por peça. */
  packagingCost: number;
}) {
  const { data: plan } = useQuery(cashPlanQuery);
  const reservePct = plan?.otherPurposesPct ?? 10;
  const taxPerSale = plan?.taxPerSale ?? 0;
  const r = calcSale({
    items,
    channel,
    otherCosts,
    productCost,
    packagingCost,
    reservePct,
    taxPerSale,
  });
  const rows: [string, number][] = [
    ["Valor da venda", r.price],
    ["Taxa do canal", -r.channelFee],
    ["Outros custos", -otherCosts],
    ["Custo dos produtos", -productCost],
    ...(r.packaging > 0 ? ([["Embalagem", -r.packaging]] as [string, number][]) : []),
    ...(r.tax > 0 ? ([["Reserva para o DAS", -r.tax]] as [string, number][]) : []),
    [`Outros fins (${reservePct.toLocaleString("pt-BR")}% da venda)`, -r.reserve],
  ];
  return (
    <div className="space-y-1 rounded-md border bg-muted/40 p-3 text-sm">
      {rows.map(([l, v]) => (
        <div key={l} className="flex justify-between">
          <span className="text-muted-foreground">{l}</span>
          <span>{formatCurrency(v)}</span>
        </div>
      ))}
      <div className="flex justify-between border-t pt-2 text-base font-semibold">
        <span>Lucro</span>
        <span className={r.profit < 0 ? "text-destructive" : ""}>
          {formatCurrency(r.profit)} ({r.margin.toLocaleString("pt-BR")}%)
        </span>
      </div>
    </div>
  );
}

export const toSaleInput = ({ packaging_items: _items, ...v }: SaleInfoValues) => ({
  ...v,
  other_costs: Number(v.other_costs || 0),
  packaging_value: v.include_packaging ? Number(v.packaging_value || 0) : 0,
});
