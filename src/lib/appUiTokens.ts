/** Tokens visuais compartilhados entre a demo da landing e o app autenticado (v3). */
export const appSurface = {
  page: '#080A0D',
  shell: '#0B0D11',
  content: '#0F1217',
  header: '#101319',
  card: '#151A21',
  input: '#11161C',
  border: '#252C35',
  borderMuted: '#343E4A',
  text: '#F8FAFC',
  muted: '#94A3B8',
} as const;

export const appInputClass =
  'app-v5-field min-h-11 w-full rounded-xl border border-[#2A323D] bg-[#11161C] px-3 py-2.5 text-sm text-[#F8FAFC] placeholder:text-[#526071] transition-colors focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/15';

export const appLabelClass =
  'app-v5-label mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#94A3B8]';

export const appPanelClass =
  'app-v5-panel rounded-2xl border border-[#252C35] bg-[#151A21] shadow-[0_18px_44px_-34px_rgba(0,0,0,0.9)]';

export const appCardClass = `${appPanelClass} p-5 sm:p-6`;
