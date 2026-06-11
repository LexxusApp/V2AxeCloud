/** Tokens visuais compartilhados entre a demo da landing e o app autenticado (v3). */
export const appSurface = {
  page: '#080A0D',
  shell: '#0B0D11',
  content: '#0D0F12',
  header: '#13171D',
  card: '#13171D',
  input: '#12161A',
  border: '#1E242B',
  borderMuted: '#2F3643',
  text: '#F1F5F9',
  muted: '#94A3B8',
} as const;

export const appInputClass =
  'w-full rounded-lg border border-[#1E242B] bg-[#12161A] px-2.5 py-2 text-xs text-[#F1F5F9] placeholder:text-zinc-600 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/30';

export const appLabelClass =
  'mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]';

export const appPanelClass =
  'rounded-2xl border border-[#1E242B] bg-[#13171D] shadow-sm';

export const appCardClass = `${appPanelClass} p-5`;
