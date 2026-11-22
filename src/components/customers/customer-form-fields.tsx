import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BRAZIL_STATES,
  CUSTOMER_SOURCES,
  CUSTOMER_STATUSES,
  DELIVERY_PREFERENCES,
} from "@/lib/commercial-constants";
import { SIZES } from "@/lib/clothing";
import {
  CEP_ERROR,
  PHONE_ERROR,
  isValidCep,
  isValidCpf,
  isValidPhone,
  maskCep,
  maskCpf,
  maskPhone,
} from "@/lib/masks";

/**
 * Cliente pessoa física. Colunas reaproveitadas da tabela customers:
 * company_name = Instagram · segment = como conheceu · company_size = tamanho · region = entrega.
 */
export type CustomerFormValues = {
  legal_name: string;
  name: string;
  company_name: string;
  document: string;
  segment: string;
  company_size: string;
  region: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  status: "prospect" | "ativo" | "inativo" | "perdido";
  notes: string;
};

export const emptyCustomerForm: CustomerFormValues = {
  legal_name: "",
  name: "",
  company_name: "",
  document: "",
  segment: "",
  company_size: "",
  region: "",
  contact_name: "",
  email: "",
  phone: "",
  address: "",
  city: "São Paulo",
  state: "SP",
  postal_code: "",
  status: "prospect",
  notes: "",
};

type Props = {
  value: CustomerFormValues;
  onChange: (value: CustomerFormValues) => void;
  /** Mantido por compatibilidade: clientes pessoa física não têm "contato" separado. */
  hideContact?: boolean;
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

/** Campos de cadastro da cliente (pessoa física), usados ao criar e editar. */
export function CustomerFormFields({ value, onChange }: Props) {
  const set = (patch: Partial<CustomerFormValues>) => onChange({ ...value, ...patch });
  const cpfInvalid = !!value.document && !isValidCpf(value.document);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Nome *</Label>
          <Input
            id="name"
            required
            value={value.name}
            onChange={(e) => set({ name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">WhatsApp</Label>
          <Input
            id="phone"
            inputMode="tel"
            placeholder="(11) 90000-0000"
            value={value.phone}
            onChange={(e) => set({ phone: maskPhone(e.target.value) })}
            aria-invalid={!!value.phone && !isValidPhone(value.phone)}
          />
          {value.phone && !isValidPhone(value.phone) && (
            <p className="text-xs text-destructive">{PHONE_ERROR}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="instagram">Instagram</Label>
          <Input
            id="instagram"
            placeholder="@usuario"
            value={value.company_name}
            onChange={(e) => set({ company_name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={value.email}
            onChange={(e) => set({ email: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="document">CPF</Label>
          <Input
            id="document"
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={value.document}
            onChange={(e) => set({ document: maskCpf(e.target.value) })}
            aria-invalid={cpfInvalid}
          />
          <p className={`text-xs ${cpfInvalid ? "text-destructive" : "text-muted-foreground"}`}>
            {cpfInvalid ? "CPF inválido." : "Opcional. Necessário para envios pelos Correios."}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Pick
          id="size"
          label="Tamanho que veste"
          value={value.company_size}
          options={SIZES}
          onChange={(v) => set({ company_size: v })}
        />
        <Pick
          id="source"
          label="Como conheceu a loja"
          value={value.segment}
          options={CUSTOMER_SOURCES}
          onChange={(v) => set({ segment: v })}
        />
        <Pick
          id="delivery"
          label="Entrega preferida"
          value={value.region}
          options={DELIVERY_PREFERENCES}
          onChange={(v) => set({ region: v })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Situação</Label>
        <Select
          value={value.status}
          onValueChange={(v) => set({ status: v as CustomerFormValues["status"] })}
        >
          <SelectTrigger id="status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CUSTOMER_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Endereço (rua, número, complemento e bairro)</Label>
        <Input
          id="address"
          value={value.address}
          onChange={(e) => set({ address: e.target.value })}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="city">Cidade</Label>
          <Input id="city" value={value.city} onChange={(e) => set({ city: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">Estado</Label>
          <Select value={value.state || undefined} onValueChange={(v) => set({ state: v })}>
            <SelectTrigger id="state">
              <SelectValue placeholder="UF" />
            </SelectTrigger>
            <SelectContent>
              {BRAZIL_STATES.map((uf) => (
                <SelectItem key={uf} value={uf}>
                  {uf}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="postal_code">CEP</Label>
          <Input
            id="postal_code"
            inputMode="numeric"
            value={value.postal_code}
            onChange={(e) => set({ postal_code: maskCep(e.target.value) })}
            placeholder="00000-000"
            aria-invalid={!!value.postal_code && !isValidCep(value.postal_code)}
          />
          {value.postal_code && !isValidCep(value.postal_code) && (
            <p className="text-xs text-destructive">{CEP_ERROR}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Observações</Label>
        <Textarea
          id="notes"
          placeholder="Ex.: medidas, modelos que gosta, aniversário, como prefere ser chamada..."
          value={value.notes}
          onChange={(e) => set({ notes: e.target.value })}
        />
      </div>
    </div>
  );
}

/** Converte o formulário no payload aceito pelas server functions. */
export function toCustomerPayload(form: CustomerFormValues) {
  return {
    name: form.name,
    legal_name: form.legal_name,
    company_name: form.company_name,
    document: form.document,
    email: form.email,
    phone: form.phone,
    address: form.address,
    city: form.city,
    state: form.state,
    postal_code: form.postal_code,
    segment: form.segment,
    company_size: form.company_size,
    region: form.region,
    status: form.status,
    notes: form.notes,
  };
}
