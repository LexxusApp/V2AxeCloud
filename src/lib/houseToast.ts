/** Toast simples da casa — prova visual de que a ação deu certo. */

export type HouseToastType = 'success' | 'info' | 'error';

export type HouseToastDetail = {
  message: string;
  type?: HouseToastType;
};

export const HOUSE_TOAST_EVENT = 'axecloud:house-toast';

export function showHouseToast(message: string, type: HouseToastType = 'success'): void {
  if (typeof window === 'undefined') return;
  const text = String(message || '').trim();
  if (!text) return;
  window.dispatchEvent(
    new CustomEvent<HouseToastDetail>(HOUSE_TOAST_EVENT, {
      detail: { message: text, type },
    }),
  );
}
