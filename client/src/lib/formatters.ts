export function formatCnpjRoot(cnpjRoot: string): string {
  if (cnpjRoot.length === 8) {
    return `${cnpjRoot.slice(0, 2)}.${cnpjRoot.slice(2, 5)}.${cnpjRoot.slice(5, 8)}`;
  }
  return cnpjRoot;
}

export function formatCnpj(cnpj: string): string {
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length === 14) {
    return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12, 14)}`;
  }
  return cnpj;
}

export function formatCpf(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9, 11)}`;
  }
  return cpf;
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6, 10)}`;
  }
  return phone;
}

export function formatNumber(num: number | null | undefined): string {
  if (num == null) return "0";
  return num.toLocaleString("pt-BR");
}
