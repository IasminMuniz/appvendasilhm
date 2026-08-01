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
import { CUSTOMER_SEGMENTS, CUSTOMER_STATUSES } from "@/lib/commercial-constants";

export type CustomerFormValues = {
  legal_name: string;
  name: string;
  company_name: string;
  document: string;
  segment: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  status: "prospect" | "ativo" | "inativo" | "perdido";
  notes: string;
};

export const emptyCustomerForm: CustomerFormValues = {
  legal_name: "",
  name: "",
  company_name: "",
  document: "",
  segment: "",
  contact_name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  status: "prospect",
  notes: "",
};

type Props = {
  value: CustomerFormValues;
  onChange: (value: CustomerFormValues) => void;
};

/** Campos de cadastro do cliente compartilhados entre criar e editar. */
export function CustomerFormFields({ value, onChange }: Props) {
  const set = (patch: Partial<CustomerFormValues>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="legal_name">Razão social</Label>
          <Input
            id="legal_name"
            value={value.legal_name}
            onChange={(e) => set({ legal_name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Nome fantasia *</Label>
          <Input
            id="name"
            value={value.name}
            onChange={(e) => set({ name: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="document">CNPJ</Label>
          <Input
            id="document"
            value={value.document}
            onChange={(e) => set({ document: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="segment">Segmento</Label>
          <Select value={value.segment || undefined} onValueChange={(v) => set({ segment: v })}>
            <SelectTrigger id="segment">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {CUSTOMER_SEGMENTS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact_name">Nome do contato</Label>
          <Input
            id="contact_name"
            value={value.contact_name}
            onChange={(e) => set({ contact_name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            value={value.phone}
            onChange={(e) => set({ phone: e.target.value })}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
          <Label htmlFor="status">Status do cliente</Label>
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Endereço</Label>
        <Input
          id="address"
          value={value.address}
          onChange={(e) => set({ address: e.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="city">Cidade</Label>
          <Input id="city" value={value.city} onChange={(e) => set({ city: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">Estado</Label>
          <Input id="state" value={value.state} onChange={(e) => set({ state: e.target.value })} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Observações</Label>
        <Textarea
          id="notes"
          rows={3}
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
    company_name: form.company_name || form.contact_name,
    document: form.document,
    email: form.email,
    phone: form.phone,
    address: form.address,
    city: form.city,
    state: form.state,
    segment: form.segment,
    status: form.status,
    notes: form.contact_name
      ? `Contato: ${form.contact_name}${form.notes ? `\n${form.notes}` : ""}`
      : form.notes,
  };
}
