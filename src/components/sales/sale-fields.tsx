import { queryOptions, useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { getCashPlan } from "@/lib/store.functions";
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
  PAYMENT_METHODS,
  calcSale,
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
}

export const emptySaleInfo: SaleInfoValues = {
  channel: "",
  payment_method: "",
  delivery_method: "",
  other_costs: "0",
  other_cost_type: "",
  include_packaging: false,
  packaging_value: "",
};

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
        options={PAYMENT_METHODS}
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
          Usei embalagem nesta venda (envelope, sacola, tag)
        </label>
        {value.include_packaging && (
          <div className="max-w-xs space-y-1">
            <Label htmlFor="packaging_value">Quanto gastou de embalagem nesta venda (R$)</Label>
            <Input
              id="packaging_value"
              type="number"
              min="0"
              step="0.01"
              placeholder="Ex.: 1,84"
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
  const r = calcSale({ items, channel, otherCosts, productCost, packagingCost, reservePct });
  const rows: [string, number][] = [
    ["Valor da venda", r.price],
    ["Taxa do canal", -r.channelFee],
    ["Outros custos", -otherCosts],
    ["Custo dos produtos", -productCost],
    ...(r.packaging > 0 ? ([["Embalagem", -r.packaging]] as [string, number][]) : []),
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

export const toSaleInput = (v: SaleInfoValues) => ({
  ...v,
  other_costs: Number(v.other_costs || 0),
  packaging_value: v.include_packaging ? Number(v.packaging_value || 0) : 0,
});
