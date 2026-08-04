/** Tour de legendas (coachmarks) do portal do filho — 1º acesso. */

export const FILHO_TOUR_DONE_KEY = 'axecloud:filho-tour-done';
export const FILHO_OPEN_TOUR_EVENT = 'axecloud:open-filho-tour';

export type FilhoTourStep = {
  id: string;
  /** Aba onde o alvo mora. */
  tab: string;
  /** Valor de `data-filho-tour` no elemento alvo. */
  target: string;
  title: string;
  body: string;
  /** Preferência de lado da legenda (o motor ajusta se não couber). */
  prefer?: 'top' | 'bottom' | 'left' | 'right';
};

/**
 * Passos curtos, apontando para UI real — não é um segundo menu.
 * Alvos ausentes (ex.: sem mensalidade pendente) são pulados automaticamente.
 */
export const FILHO_TOUR_STEPS: FilhoTourStep[] = [
  {
    id: 'home-attention',
    tab: 'profile',
    target: 'home-attention',
    title: 'O que pede sua atenção',
    body: 'Quando a casa precisar de algo seu — mensalidade, gira ou orientação — o aviso principal aparece aqui.',
    prefer: 'bottom',
  },
  {
    id: 'nav-mensalidade',
    tab: 'profile',
    target: 'nav-mensalidade',
    title: 'Mensalidade',
    body: 'Por aqui você vê se está em dia, paga com Pix e envia o comprovante.',
    prefer: 'top',
  },
  {
    id: 'mensalidade-pix',
    tab: 'financial',
    target: 'mensalidade-pix',
    title: 'Pagar com Pix',
    body: 'Toque aqui para gerar o QR Code e pagar a contribuição da casa.',
    prefer: 'top',
  },
  {
    id: 'mensalidade-comprovante',
    tab: 'financial',
    target: 'mensalidade-comprovante',
    title: 'Enviar comprovante',
    body: 'Já pagou a mensalidade? Envie o comprovante para o sistema atualizar seu pagamento.',
    prefer: 'top',
  },
  {
    id: 'nav-giras',
    tab: 'financial',
    target: 'nav-giras',
    title: 'Giras',
    body: 'Na agenda você vê os encontros da casa e confirma se vai participar.',
    prefer: 'top',
  },
  {
    id: 'gira-confirmar',
    tab: 'calendar',
    target: 'gira-confirmar',
    title: 'Confirmar presença',
    body: 'A casa precisa saber quem estará na corrente. Confirme ou avise que não poderá ir.',
    prefer: 'top',
  },
  {
    id: 'nav-conversas',
    tab: 'calendar',
    target: 'nav-conversas',
    title: 'Conversas',
    body: 'Dúvida ou recado? Fale direto com a casa por aqui.',
    prefer: 'top',
  },
  {
    id: 'header-notificacoes',
    tab: 'profile',
    target: 'header-notificacoes',
    title: 'Avisos',
    body: 'O sino guarda os avisos importantes. Quando algo novo chegar, o alerta aparece nele.',
    prefer: 'bottom',
  },
];

export function openFilhoTour(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FILHO_OPEN_TOUR_EVENT));
}

/** @deprecated use openFilhoTour */
export function openFilhoGuide(): void {
  openFilhoTour();
}
