type EfiCreditCardApi = {
  setAccount: (id: string) => EfiCreditCardApi;
  setEnvironment: (env: 'production' | 'sandbox') => EfiCreditCardApi;
  setCreditCardData: (data: Record<string, unknown>) => EfiCreditCardApi;
  getPaymentToken: () => Promise<{ payment_token: string; card_mask?: string }>;
  setCardNumber: (n: string) => { verifyCardBrand: () => Promise<string> };
};

declare global {
  interface Window {
    EfiPay?: { CreditCard: EfiCreditCardApi };
    EfiJs?: { CreditCard: EfiCreditCardApi };
  }
}

function getEfiCreditCard(): EfiCreditCardApi | null {
  return window.EfiPay?.CreditCard ?? window.EfiJs?.CreditCard ?? null;
}

const EFI_SCRIPT =
  'https://cdn.jsdelivr.net/npm/payment-token-efi@3.2.1/dist/payment-token-efi-umd.min.js';

let scriptPromise: Promise<void> | null = null;

export function loadEfiPaymentScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Browser only'));
  if (getEfiCreditCard()) return Promise.resolve();

  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${EFI_SCRIPT}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Falha ao carregar SDK EFI')));
        return;
      }
      const script = document.createElement('script');
      script.src = EFI_SCRIPT;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Falha ao carregar SDK EFI'));
      document.head.appendChild(script);
    });
  }

  return scriptPromise;
}

export type CardTokenInput = {
  payeeCode: string;
  sandbox: boolean;
  brand: string;
  number: string;
  cvv: string;
  expirationMonth: string;
  expirationYear: string;
  holderName: string;
  holderDocument: string;
};

export async function createEfiPaymentToken(
  input: CardTokenInput
): Promise<{ payment_token: string; card_mask?: string }> {
  await loadEfiPaymentScript();
  const card = getEfiCreditCard();
  if (!card) throw new Error('SDK de pagamento EFI indisponível');

  const env = input.sandbox ? 'sandbox' : 'production';
  const year =
    input.expirationYear.length === 2 ? `20${input.expirationYear}` : input.expirationYear;

  return card.setAccount(input.payeeCode)
    .setEnvironment(env)
    .setCreditCardData({
      brand: input.brand,
      number: input.number.replace(/\D/g, ''),
      cvv: input.cvv.replace(/\D/g, ''),
      expirationMonth: input.expirationMonth.padStart(2, '0'),
      expirationYear: year,
      holderName: input.holderName,
      holderDocument: input.holderDocument.replace(/\D/g, ''),
      reuse: true,
    })
    .getPaymentToken();
}

export async function detectCardBrand(cardNumber: string): Promise<string> {
  await loadEfiPaymentScript();
  const card = getEfiCreditCard();
  if (!card) return 'visa';

  try {
    const brand = await card.setCardNumber(cardNumber.replace(/\D/g, '')).verifyCardBrand();
    return brand && brand !== 'undefined' ? brand : 'visa';
  } catch {
    return 'visa';
  }
}
