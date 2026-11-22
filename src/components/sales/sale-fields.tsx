import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/commercial-constants";
import { CHANNELS, DELIVERY_METHODS, OTHER_COST_TYPES, PACKAGING_COST, PAYMENT_METHODS, calcSale } from "@/lib/sales";

export interface SaleInfoValues {
  channel: string;
  payment_method: string;
  delivery_method: string;
  other_costs: string;
  other_cost_type: string;
}

export const emptySaleInfo: SaleInfoValues = {
  channel: "", payment_method: "", delivery_method: "", other_costs: "0", other_cost_type: "",
};

function Pick({ id, label, value, options, onChange }: {
  id: string; label: string; value: string; options: readonly string[]; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id={id}><SelectValue placeholder="Selecione" /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export function SaleFields({ value, onChange }: { value: SaleInfoValues; onChange: (v: SaleInfoValues) => void }) {
  const set = (patch: Partial<SaleInfoValues>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Pick id="channel" label="Canal" value={value.channel} options={CHANNELS} onChange={(v) => set({ channel: v })} />
      <Pick id="payment" label="Forma de pagamento" value={value.payment_method} options={PAYMENT_METHODS} onChange={(v) => set({ payment_method: v })} />
      <Pick id="delivery" label="Entrega" value={value.delivery_method} options={DELIVERY_METHODS} onChange={(v) => set({ delivery_method: v })} />
      <div />
      <div className="space-y-2">
        <Label htmlFor="other_costs">Outros custos (R$)</Label>
        <Input id="other_costs" type="number" min="0" step="0.01" value={value.other_costs} onChange={(e) => set({ other_costs: e.target.value })} />
      </div>
      <Pick id="other_cost_type" label="Tipo de custo" value={value.other_cost_type} options={OTHER_COST_TYPES} onChange={(v) => set({ other_cost_type: v })} />
    </div>
  );
}

export function SaleSummary({ price, channel, otherCosts, productCost }: {
  price: number; channel: string | null | undefined; otherCosts: number; productCost: number;
}) {
  const r = calcSale({ price, channel, otherCosts, productCost });
  const rows: [string, number][] = [
    ["Valor da venda", price],
    ["Taxa do canal", -r.channelFee],
    ["Outros custos", -otherCosts],
    ["Custo dos produtos", -productCost],
    ["Embalagem", -PACKAGING_COST],
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

export const toSaleInput = (v: SaleInfoValues) => ({ ...v, other_costs: Number(v.other_costs || 0) });
