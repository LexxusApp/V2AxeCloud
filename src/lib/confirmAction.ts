export type HouseConfirmTone = 'danger' | 'warning' | 'primary';

export type HouseConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: HouseConfirmTone;
};

export const HOUSE_CONFIRM_EVENT = 'axecloud:confirm-action';

type HouseConfirmEventDetail = HouseConfirmOptions & {
  resolve: (confirmed: boolean) => void;
};

export function confirmAction(options: HouseConfirmOptions): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    window.dispatchEvent(
      new CustomEvent<HouseConfirmEventDetail>(HOUSE_CONFIRM_EVENT, {
        detail: { ...options, resolve },
      }),
    );
  });
}

export type { HouseConfirmEventDetail };
