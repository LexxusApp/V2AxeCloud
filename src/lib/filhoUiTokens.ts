/** Painéis e seções do portal do filho de santo — alinhados ao app v3. */
export const filhoPanelClass =
  'rounded-2xl border border-[#1E242B] bg-[#13171D] shadow-sm';

/** Cards com pouco conteúdo — largura pelo conteúdo, não pela tela inteira. */
export const filhoChipPanelClass = 'w-fit max-w-full';

export const filhoPanelInsetClass =
  'rounded-xl border border-[#1E242B] bg-[#12161A]';

export const filhoKickerClass =
  'text-[10px] font-bold uppercase tracking-[0.2em] text-primary';

export const filhoSectionTitleClass = 'text-base font-bold text-[#F1F5F9] sm:text-lg';

/** Cabeçalho padrão de módulo na dashboard do filho. */
export const filhoSectionHeaderClass =
  'mb-3 flex items-center justify-between gap-2 border-b border-[#1E242B] pb-2';

export const filhoSectionLinkClass =
  'inline-flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#64748B] transition-colors hover:text-primary';

export const filhoPanelPaddingClass = 'p-4 sm:p-5';

/** Card de módulo na dashboard — preenche a célula do grid. */
export const filhoModuleClass =
  [filhoPanelClass, filhoPanelPaddingClass, 'flex h-full flex-col'].join(' ');

export const filhoDashboardShellClass =
  'overflow-hidden rounded-2xl border border-[#1E242B] bg-[#13171D] shadow-sm';

export const filhoDashboardDividerClass = 'border-[#1E242B]';
