export const COMMERCIAL_WHATSAPP_NUMBER = '5511912276156';

export const COMMERCIAL_WHATSAPP_URL = `https://wa.me/${COMMERCIAL_WHATSAPP_NUMBER}`;

export function commercialWhatsAppUrl(message: string): string {
  return `${COMMERCIAL_WHATSAPP_URL}?text=${encodeURIComponent(message)}`;
}
