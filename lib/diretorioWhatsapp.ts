function digitsOnly(value: unknown): string {
  return String(value || "").replace(/\D/g, "");
}

function normalizeBrazilianPhone(value: unknown): string | null {
  let digits = digitsOnly(value);
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (!/^55[1-9]\d(?:\d{8}|\d{9})$/.test(digits)) return null;
  return digits;
}

/**
 * Resolve o contato que pode receber o CTA público de WhatsApp.
 * Um campo explicitamente informado aceita celular ou WhatsApp Business fixo;
 * números antigos importados do Maps só são aceitos quando têm formato móvel.
 */
export function resolveDiretorioWhatsapp(explicitWhatsapp: unknown, telefone: unknown): string | null {
  const explicit = normalizeBrazilianPhone(explicitWhatsapp);
  if (explicit) return explicit;

  const inferred = normalizeBrazilianPhone(telefone);
  if (!inferred) return null;
  const nationalNumber = inferred.slice(4);
  return nationalNumber.length === 9 && nationalNumber.startsWith("9") ? inferred : null;
}

/** Importação ou verificação não equivalem a um perfil administrado pela casa. */
export function resolveDiretorioPublicWhatsapp(row: Record<string, unknown>): string | null {
  if (!row.claimed_by_tenant_id && row.gerenciada !== true) return null;
  return resolveDiretorioWhatsapp(row.whatsapp_atendimento || row.whatsapp, row.telefone);
}

export function buildDiretorioWhatsappHref(
  profile: { nome: string; gerenciada?: boolean; whatsapp?: string | null },
  preferred?: string | null,
): string | null {
  if (profile.gerenciada !== true) return null;
  const phone = normalizeBrazilianPhone(preferred || profile.whatsapp);
  if (!phone) return null;
  const message = `Olá! Conheci o ${profile.nome} através do AxéCloud Gestão de Terreiros e gostaria de receber mais informações sobre giras e atendimentos.`;
  return 'https://wa.me/' + phone + '?text=' + encodeURIComponent(message);
}
