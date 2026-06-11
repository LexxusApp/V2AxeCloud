export type DemoFilho = {
  id: string;
  nome: string;
  cargo: string;
  orixaFrente: string;
  guiaEspiritual: string;
  status: 'Ativo' | 'Pendente' | 'Inativo';
  avatarTone: string;
};

export type DemoLancamento = {
  id: string;
  descricao: string;
  tipo: 'Entrada' | 'Saída';
  valor: number;
  categoria: string;
  data: string;
};

export type DemoGira = {
  id: string;
  nome: string;
  tipo: string;
  data: string;
  horario: string;
  status: 'Confirmada' | 'Especial';
};

export type DemoAviso = {
  id: string;
  titulo: string;
  autor: string;
  resumo: string;
  data: string;
  fixado?: boolean;
};

export const DEMO_HOUSE_NAME = 'Ilê Axé Luz da Corrente';

export const DEMO_FILHOS_INITIAL: DemoFilho[] = [
  {
    id: '1',
    nome: 'Mariana de Iansã',
    cargo: 'Médium de Desenvolvimento',
    orixaFrente: 'Iansã',
    guiaEspiritual: 'Caboclo Ventania',
    status: 'Ativo',
    avatarTone: 'bg-amber-500/20 text-amber-300',
  },
  {
    id: '2',
    nome: 'Pai Alexandre de Ogum',
    cargo: 'Zelador de Santo',
    orixaFrente: 'Ogum',
    guiaEspiritual: 'Caboclo Sete Flechas',
    status: 'Ativo',
    avatarTone: 'bg-sky-500/20 text-sky-300',
  },
  {
    id: '3',
    nome: 'Vinícius do Atabaque',
    cargo: 'Ogã',
    orixaFrente: 'Oxóssi',
    guiaEspiritual: 'Preto Velho Pai Joaquim',
    status: 'Ativo',
    avatarTone: 'bg-emerald-500/20 text-emerald-300',
  },
  {
    id: '4',
    nome: 'Clara de Oxum',
    cargo: 'Cambone',
    orixaFrente: 'Oxum',
    guiaEspiritual: 'Cabocla Jurema',
    status: 'Pendente',
    avatarTone: 'bg-rose-500/20 text-rose-300',
  },
];

export const DEMO_LANCAMENTOS_INITIAL: DemoLancamento[] = [
  {
    id: '1',
    descricao: 'Mensalidades do corpo mediúnico (junho)',
    tipo: 'Entrada',
    valor: 650,
    categoria: 'Mensalidade',
    data: '2026-06-05',
  },
  {
    id: '2',
    descricao: 'Velas brancas e coloridas para o congá',
    tipo: 'Saída',
    valor: 145.2,
    categoria: 'Material litúrgico',
    data: '2026-06-04',
  },
  {
    id: '3',
    descricao: 'Doação para festa de Iemanjá',
    tipo: 'Entrada',
    valor: 250,
    categoria: 'Doação',
    data: '2026-06-02',
  },
  {
    id: '4',
    descricao: 'Ervas frescas — mercado central',
    tipo: 'Saída',
    valor: 89.9,
    categoria: 'Oferendas',
    data: '2026-06-01',
  },
];

export const DEMO_GIRAS_INITIAL: DemoGira[] = [
  {
    id: '1',
    nome: 'Gira de Baianos e Boiadeiros',
    tipo: 'Caridade',
    data: '2026-06-09',
    horario: '20:00',
    status: 'Confirmada',
  },
  {
    id: '2',
    nome: 'Louvação anual — homenagem a Xangô',
    tipo: 'Festa pública',
    data: '2026-06-20',
    horario: '19:00',
    status: 'Especial',
  },
  {
    id: '3',
    nome: 'Gira de Caboclos e Pretos Velhos',
    tipo: 'Normal',
    data: '2026-06-23',
    horario: '20:00',
    status: 'Confirmada',
  },
];

export const DEMO_AVISOS_INITIAL: DemoAviso[] = [
  {
    id: '1',
    titulo: 'Escala da gira de sábado',
    autor: 'Zeladoria',
    resumo: 'Ogãs e cambones confirmados para abertura às 19h30. Filhos em obrigação avisar com antecedência.',
    data: '2026-06-07',
    fixado: true,
  },
  {
    id: '2',
    titulo: 'Mensalidade de junho',
    autor: 'Financeiro',
    resumo: 'Lembretes automáticos no WhatsApp três dias antes do vencimento. Pix disponível no portal do filho.',
    data: '2026-06-05',
  },
  {
    id: '3',
    titulo: 'Estudo — fundamentos da linha',
    autor: 'Biblioteca',
    resumo: 'Material novo na biblioteca de estudos. Recomendado para filhos em desenvolvimento.',
    data: '2026-06-03',
  },
];

export const DEMO_AVATAR_TONES = [
  'bg-amber-500/20 text-amber-300',
  'bg-sky-500/20 text-sky-300',
  'bg-emerald-500/20 text-emerald-300',
  'bg-rose-500/20 text-rose-300',
  'bg-violet-500/20 text-violet-300',
] as const;

export function formatDemoDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function formatDemoMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
