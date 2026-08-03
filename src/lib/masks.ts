import { z } from "zod";

/** Aplica máscara de CEP: 00000-000 */
export function maskCep(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/** Aplica máscara de telefone BR: (00) 0000-0000 ou (00) 00000-0000 */
export function maskPhone(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Aplica máscara de CNPJ: 00.000.000/0000-00 */
export function maskCnpj(input: string): string {
  const d = input.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export const isValidCnpj = (value: string) => value.replace(/\D/g, "").length === 14;
export const CNPJ_ERROR = "CNPJ inválido. Informe 14 dígitos.";

export const cnpjSchema = z
  .string()
  .trim()
  .max(18)
  .refine((v) => v === "" || isValidCnpj(v), { message: CNPJ_ERROR });

export const isValidCep = (value: string) => /^\d{5}-?\d{3}$/.test(value.trim());
export const isValidPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11;
};

export const CEP_ERROR = "CEP inválido. Use o formato 00000-000.";
export const PHONE_ERROR = "Telefone inválido. Use DDD + 8 ou 9 dígitos.";

/** Schemas reutilizáveis (aceitam vazio, validam quando preenchidos). */
export const cepSchema = z
  .string()
  .trim()
  .max(9)
  .refine((v) => v === "" || isValidCep(v), { message: CEP_ERROR });

export const phoneSchema = z
  .string()
  .trim()
  .max(20)
  .refine((v) => v === "" || isValidPhone(v), { message: PHONE_ERROR });

/** Valida CEP e telefone de um formulário; retorna a primeira mensagem de erro. */
export function validateContactFields(values: {
  phone?: string;
  postal_code?: string;
}): string | null {
  if (values.postal_code && !isValidCep(values.postal_code)) return CEP_ERROR;
  if (values.phone && !isValidPhone(values.phone)) return PHONE_ERROR;
  return null;
}
