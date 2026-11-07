// Synthetic data and pure helpers used only by the standalone local prototype.
export type Response = 'confirmed' | 'absent';
export type DemoGira = { highlight?: boolean; reminder?: boolean; capacity?: number;
  id: string; title: string; date: string; time: string; place: string;
  type: 'Gira' | 'Trabalho' | 'Encontro'; status: 'scheduled' | 'done';
  responses: Record<string, Response>; instructions: string; noticeDraft: string;
  noticeSaved: boolean; tasks: string[]; queue: { id?:string; name?:string; phone?:string; number: number; state: 'waiting' | 'called' | 'done' }[];
};
export const DEMO_TODAY = new Intl.DateTimeFormat('en-CA', {year:'numeric',month:'2-digit',day:'2-digit',timeZone:'America/Sao_Paulo'}).format(new Date());
export const giraTimestamp = (g: Pick<DemoGira, 'date' | 'time'>) => `${g.date}T${g.time}:00-03:00`;
export const nextGira = (giras: DemoGira[]) => [...giras].filter(g => g.status === 'scheduled' && g.date >= DEMO_TODAY).sort((a, b) => giraTimestamp(a).localeCompare(giraTimestamp(b)))[0];
export const formatGiraDate = (g: DemoGira, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', { ...options, timeZone: 'America/Sao_Paulo' }).format(new Date(giraTimestamp(g)));
const base = { place: 'Terreiro principal', type: 'Gira' as const, instructions: '', noticeDraft: '', noticeSaved: false, tasks: ['presenca'], queue: [] };
export const demoGiras: DemoGira[] = [
  { ...base, id: 'caboclo', title: 'Gira de Caboclo', date: '2026-10-31', time: '20:00', status: 'scheduled', responses: Object.fromEntries([1, 2, 3, 4, 5, 6].map(i => [`demo-${i}`, 'confirmed' as const])) },
  { ...base, id: 'preto-velho', title: 'Gira de Preto-Velho', date: '2026-11-14', time: '19:30', status: 'scheduled', responses: {}, tasks: [] },
  { ...base, id: 'encontro-anterior', title: 'Encontro da corrente', type: 'Encontro', date: '2026-10-24', time: '18:00', status: 'done', responses: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(i => [`demo-${i}`, 'confirmed' as const])), tasks: ['materiais', 'presenca', 'memoria'], noticeSaved: true },
];
