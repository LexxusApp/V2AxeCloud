/**
 * Módulo de Controle da Cantina / Lojinha do Terreiro
 * Disponível para os terreiros; as permissões são verificadas pela API.
 */


export function isCantinaEnabled(
  _tenantData?: { tenant_id?: string | null; email?: string | null } | null,
  _userEmail?: string | null,
  _userId?: string | null
): boolean {
  // Cantina liberada globalmente para todos os terreiros
  return true;
}

export function buildCantinaWhatsAppMessage(
  filho: {
    nome: string;
    whatsapp_phone?: string | null;
    saldo_pendente: number;
    pedidos_pendentes?: Array<{ descricao: string; valor: number; data: string }>;
  },
  terreiroNome?: string,
  chavePix?: string
): string {
  const primeiroNome = (filho.nome || '').trim().split(' ')[0] || 'Irmão(ã)';
  const lines: string[] = [
    `Olá, *${primeiroNome}*! Salve o Axé! ✨`,
    ``,
    `Passando o extrato da sua *caderneta de Loja e Cantina*${terreiroNome ? ` (*${terreiroNome}*)` : ''}:`,
    ``,
  ];

  if (filho.pedidos_pendentes && filho.pedidos_pendentes.length > 0) {
    filho.pedidos_pendentes.forEach((p) => {
      let desc = p.descricao || 'Item da cantina';
      desc = desc.replace(/^Cantina\s*-\s*[^-(]+\s*-\s*/i, '').replace(/\s*\(ID:[^)]+\)/, '').trim();
      lines.push(`• ${desc} — ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.valor)}`);
    });
    lines.push(``);
  }

  lines.push(`💳 *Total em aberto:* *${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(filho.saldo_pendente)}*`);

  if (chavePix) {
    lines.push(``);
    lines.push(`🔑 *Chave Pix para acerto:* \`${chavePix}\``);
  }

  lines.push(``);
  lines.push(`Caso já tenha realizado o pagamento ou queira acertar junto com a mensalidade, por favor nos avise. Axé! 🙏`);

  return lines.join('\n');
}

export function buildWhatsAppLink(phone: string | null | undefined, text: string): string {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const encoded = encodeURIComponent(text);
  if (!cleanPhone) {
    return `https://wa.me/?text=${encoded}`;
  }
  const withCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
  return `https://wa.me/${withCountry}?text=${encoded}`;
}
