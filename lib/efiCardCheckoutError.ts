/** Mensagem exibida quando a Efí recusa ou não processa o cartão (limite operacional, validação, etc.). */
export const EFI_CARD_PIX_FALLBACK_MESSAGE =
  'Aviso: Não foi possível processar o pagamento via cartão no momento. Por favor, tente novamente utilizando a opção PIX para liberação imediata do seu terreiro.';

const LOCAL_CARD_VALIDATION_RE =
  /^(cpf do titular|cep inválido|payment_token|não autorizado|efi não configurado|tenantid|assinatura já)/i;

type EfiErrorBody = {
  error?: string;
  code?: number | string;
  error_description?: string | unknown;
};

function readEfiErrorBody(err: unknown): EfiErrorBody | null {
  const data = (err as { response?: { data?: EfiErrorBody } })?.response?.data;
  if (data && typeof data === 'object') return data;
  if (err && typeof err === 'object' && ('error' in err || 'code' in err || 'error_description' in err)) {
    return err as EfiErrorBody;
  }
  return null;
}

function flattenEfiDescription(desc: unknown): string {
  if (typeof desc === 'string') return desc;
  if (Array.isArray(desc)) {
    return desc
      .map((item) => {
        if (item && typeof item === 'object') {
          const row = item as { property?: string; message?: string };
          return [row.property, row.message].filter(Boolean).join(' — ');
        }
        return String(item);
      })
      .join(' · ');
  }
  if (desc && typeof desc === 'object') {
    const row = desc as { property?: string; message?: string };
    return [row.property, row.message].filter(Boolean).join(' — ');
  }
  return '';
}

/** Extrai texto legível de erros do SDK payment-token-efi ou da API Efí. */
export function extractEfiErrorText(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim();

  const body = readEfiErrorBody(err);
  if (body) {
    const parts: string[] = [];
    const desc = flattenEfiDescription(body.error_description);
    if (desc) parts.push(desc);
    if (typeof body.error === 'string' && body.error.trim()) parts.push(body.error.trim());
    if (body.code != null) parts.unshift(`Efí [${body.code}]`);
    if (parts.length) return parts.join(': ');
  }

  if (typeof err === 'string' && err.trim()) return err.trim();
  return '';
}

export function isLocalCardCheckoutValidationMessage(message: string): boolean {
  const m = message.trim();
  if (!m) return false;
  return LOCAL_CARD_VALIDATION_RE.test(m);
}

/** Erros da Efí (API ou SDK) em que o usuário deve tentar PIX. */
export function isEfiCardProcessingFailure(
  err: unknown,
  opts?: { suggestPix?: boolean; httpStatus?: number; message?: string }
): boolean {
  if (opts?.suggestPix === true) return true;

  const body = readEfiErrorBody(err);
  if (body?.error === 'validation_error') return true;
  const codeNum = Number(body?.code);
  if (codeNum === 3500034) return true;

  const text = (opts?.message || extractEfiErrorText(err)).toLowerCase();
  if (/limite\s*operacional/.test(text)) return true;
  if (text.includes('operacional') && text.includes('limite')) return true;
  if (text.includes('validation_error') || text.includes('efi [')) return true;

  const httpStatus =
    opts?.httpStatus ??
    (err as { response?: { status?: number } })?.response?.status;
  if (httpStatus === 412) return true;

  if (httpStatus === 400 || httpStatus === 422 || httpStatus === 500) {
    if (text && !isLocalCardCheckoutValidationMessage(text)) return true;
  }

  // Falha ao tokenizar no browser (SDK) sem mensagem local conhecida
  if (!httpStatus && text && !isLocalCardCheckoutValidationMessage(text)) {
    if (
      text.includes('efi') ||
      text.includes('token') ||
      text.includes('cartão') ||
      text.includes('cartao') ||
      text.includes('payment')
    ) {
      return true;
    }
  }

  return false;
}

export function resolveCardPaymentUserMessage(
  err: unknown,
  opts?: { suggestPix?: boolean; httpStatus?: number; message?: string }
): string {
  if (isEfiCardProcessingFailure(err, opts)) return EFI_CARD_PIX_FALLBACK_MESSAGE;
  const text = extractEfiErrorText(err);
  if (text) return text;
  return 'Erro no pagamento com cartão.';
}
