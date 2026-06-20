/** Dados e tipos do Espaço do Fiel — portados de axe-cloudv3 (Google AI Studio). */

export interface PrayerChatMessage {
  id: string;
  sender: 'Zelador' | 'Visitante';
  text: string;
  time: string;
}

export type VelaCor = 'Branca' | 'Vermelha' | 'Azul' | 'Verde' | 'Amarela' | 'Preta' | 'Nenhuma';

export interface PrayerRequest {
  id: string;
  solicitante: string;
  casa: string;
  categoria: string;
  linha: string;
  vela: VelaCor;
  status: 'Pendente' | 'Aceito' | 'Em Oração';
  intencao: string;
  data: string;
  chatMessages: PrayerChatMessage[];
}

export interface TerreiroHouse {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
  endereco: string;
  telefone: string;
}

export const CASAS_PARCEIRAS: TerreiroHouse[] = [
  { id: 'casa-1', nome: 'Terreiro Caboclo Ventania', cidade: 'São Paulo', estado: 'SP', endereco: 'Rua das Almas, 140 - Jabaquara', telefone: '(11) 98765-4321' },
  { id: 'casa-2', nome: 'Centro Espiritual Luz de Aruanda', cidade: 'Rio de Janeiro', estado: 'RJ', endereco: 'Av. Copacabana, 820 - Copacabana', telefone: '(21) 97765-1122' },
  { id: 'casa-3', nome: 'Templo da Estrela D\'Alva', cidade: 'Salvador', estado: 'BA', endereco: 'Rua do Bonfim, 45 - Bonfim', telefone: '(71) 96123-4567' },
  { id: 'casa-4', nome: 'Cabana de Pai Joaquim', cidade: 'Belo Horizonte', estado: 'MG', endereco: 'Rua dos Inconfidentes, 210 - Savassi', telefone: '(31) 99888-7766' },
  { id: 'casa-5', nome: 'Ylê Axé Oxalá e Yemanjá', cidade: 'São Paulo', estado: 'SP', endereco: 'Av. Paulista, 2400 - Bela Vista', telefone: '(11) 95555-4444' },
  { id: 'casa-6', nome: 'Terreiro Vovó Maria Conga', cidade: 'Curitiba', estado: 'PR', endereco: 'Rua XV de Novembro, 1050 - Centro', telefone: '(41) 94444-3333' },
  { id: 'casa-7', nome: 'Centro de Caridade Caboclo Ogum Beira-Mar', cidade: 'Rio de Janeiro', estado: 'RJ', endereco: 'Estrada do Galeão, 340 - Ilha do Governador', telefone: '(21) 92222-1111' },
  { id: 'casa-8', nome: 'Abassá de Ogum', cidade: 'Porto Alegre', estado: 'RS', endereco: 'Av. Ipiranga, 450 - Praia de Belas', telefone: '(51) 93333-2222' },
];

export const PRAYER_REQUESTS_INITIAL: PrayerRequest[] = [
  {
    id: 'pr-1',
    solicitante: 'Carlos de Souza',
    casa: 'Terreiro Caboclo Ventania',
    categoria: 'Saúde',
    linha: 'Pretos Velhos / Almas',
    vela: 'Branca',
    status: 'Aceito',
    intencao: 'Peço saúde e paz de espírito para minha mãe de 74 anos que está em recuperação de uma cirurgia cardíaca.',
    data: '2026-06-08 14:30',
    chatMessages: [
      { id: 'm1', sender: 'Visitante', text: 'Olá Zelador, gostaria de pedir uma reza especial para minha mãe.', time: '14:30' },
      { id: 'm2', sender: 'Zelador', text: 'Saravá, meu irmão Carlos. O pedido foi aceito. Já firmamos a vela branca e incluímos o nome dela em nossa corrente de oração com os Pretos Velhos.', time: '15:12' },
    ],
  },
  {
    id: 'pr-2',
    solicitante: 'Juliana Mendes',
    casa: 'Terreiro Caboclo Ventania',
    categoria: 'Proteção',
    linha: 'Caboclos',
    vela: 'Vermelha',
    status: 'Pendente',
    intencao: 'Abertura de caminhos profissionais e proteção no novo emprego, pois ando sentindo muito peso nas costas e cansaço excessivo.',
    data: '2026-06-09 01:10',
    chatMessages: [
      { id: 'm3', sender: 'Visitante', text: 'Tenho me sentido muito cansada ultimamente no trabalho. Peço auxílio de Ogum.', time: '01:10' },
    ],
  },
  {
    id: 'pr-3',
    solicitante: 'Ricardo Amaro',
    casa: 'Templo da Estrela D\'Alva',
    categoria: 'Limpeza Espiritual',
    linha: 'Pretos Velhos / Almas',
    vela: 'Branca',
    status: 'Pendente',
    intencao: 'Descarrego de energias negativas acumuladas no meu lar após visitas problemáticas.',
    data: '2026-06-09 02:00',
    chatMessages: [
      { id: 'm4', sender: 'Visitante', text: 'Peço descarrego urgente de energias pesadas na minha residência.', time: '02:00' },
    ],
  },
];

export const CANDLE_COLOR_HEX: Record<string, string> = {
  Branca: '#FFFFFF',
  Vermelha: '#EF4444',
  Azul: '#3B82F6',
  Verde: '#10B981',
  Amarela: '#F59E0B',
  Preta: '#27272A',
  Nenhuma: '#6B7280',
};

export const VELA_OPTIONS = [
  { color: 'Branca' as const, bg: 'bg-white text-gray-950 border-gray-400' },
  { color: 'Vermelha' as const, bg: 'bg-red-600 text-white border-red-800' },
  { color: 'Azul' as const, bg: 'bg-blue-600 text-white border-blue-800' },
  { color: 'Verde' as const, bg: 'bg-emerald-600 text-white border-emerald-850' },
  { color: 'Amarela' as const, bg: 'bg-yellow-500 text-gray-950 border-yellow-700' },
  { color: 'Preta' as const, bg: 'bg-gray-950 text-white border-gray-900' },
  { color: 'Nenhuma' as const, bg: 'bg-transparent text-neutral-500 border-[#ece4d2]' },
];

export const CIDADES_FILTRO = ['Todas', 'São Paulo', 'Rio de Janeiro', 'Salvador', 'Belo Horizonte', 'Curitiba', 'Porto Alegre'] as const;
