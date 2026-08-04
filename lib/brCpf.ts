/** Validação de CPF brasileiro (dígitos verificadores). */

export function digitsOnlyCpf(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

/** CPF válido com 11 dígitos e dígitos verificadores corretos. */
export function isValidCpf(value: string): boolean {
  const cpf = digitsOnlyCpf(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calc = (base: string, factor: number): number => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
      sum += Number(base[i]) * (factor - i);
    }
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  const d1 = calc(cpf.slice(0, 9), 10);
  if (d1 !== Number(cpf[9])) return false;
  const d2 = calc(cpf.slice(0, 10), 11);
  return d2 === Number(cpf[10]);
}

/**
 * Cadastro do filho: aceita 6 dígitos (senha de acesso) ou CPF completo válido (11).
 * Valores fracos (000000, 123456…) são rejeitados em `isWeakFilhoSenha`.
 */
export function isValidFilhoCpfCadastro(value: string): boolean {
  const cpf = digitsOnlyCpf(value);
  if (cpf.length === 6) return /^\d{6}$/.test(cpf) && !isWeakFilhoSenha(cpf);
  if (cpf.length === 11) return isValidCpf(cpf) && !isWeakFilhoSenha(cpf.slice(0, 6));
  return false;
}

/** Senha de acesso do filho = 6 primeiros dígitos do CPF (ou os 6 dígitos cadastrados). */
export function filhoSenhaFromCpf(value: string): string | null {
  const cpf = digitsOnlyCpf(value);
  if (cpf.length < 6) return null;
  return cpf.slice(0, 6);
}

/** Senhas fracas / placeholder que não devem ser enviadas. */
export function isWeakFilhoSenha(senha: string): boolean {
  const s = String(senha || "");
  if (!/^\d{6}$/.test(s)) return true;
  if (/^(\d)\1{5}$/.test(s)) return true; // 000000, 111111…
  if (s === "123456" || s === "654321") return true;
  return false;
}
