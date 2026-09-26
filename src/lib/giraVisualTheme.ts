import type { DashboardNextEvent } from '../components/dashboard/DashboardProximaGira';

export type GiraVisualThemeId =
  | 'caboclo'
  | 'exu'
  | 'preto-velho'
  | 'ere'
  | 'marinheiro'
  | 'boiadeiro'
  | 'ogum'
  | 'oxum'
  | 'iemanja'
  | 'xango'
  | 'default';

export type GiraVisualTheme = {
  id: GiraVisualThemeId;
  label: string;
  phrase: string;
  variant: number;
};

const THEME_RULES: Array<{ id: GiraVisualThemeId; label: string; phrase: string; terms: string[] }> = [
  { id: 'exu', label: 'Caminhos e movimento', phrase: 'Caminho aberto, presença e transformação.', terms: ['exu', 'pomba gira', 'pombagira', 'malandro', 'malandra'] },
  { id: 'preto-velho', label: 'Ancestralidade e sabedoria', phrase: 'Calma no passo, firmeza no fundamento.', terms: ['preto velho', 'preta velha', 'pretos velhos', 'vovo', 'vovó', 'vovô'] },
  { id: 'ere', label: 'Alegria e renovação', phrase: 'Leveza, cuidado e futuro para a corrente.', terms: ['ere', 'erê', 'eres', 'erês', 'ibeji', 'crianca', 'criança', 'cosme', 'damiao', 'damião'] },
  { id: 'marinheiro', label: 'Maré e travessia', phrase: 'Equilíbrio para atravessar cada movimento.', terms: ['marinheiro', 'marinheira', 'marujo', 'mar'] },
  { id: 'boiadeiro', label: 'Campo e firmeza', phrase: 'Estrada firme, proteção e condução.', terms: ['boiadeiro', 'boiadeira', 'vaqueiro'] },
  { id: 'ogum', label: 'Ferro e caminho', phrase: 'Disciplina para abrir caminhos e seguir.', terms: ['ogum', 'sao jorge', 'são jorge'] },
  { id: 'oxum', label: 'Água doce e prosperidade', phrase: 'Doçura, beleza e abundância em movimento.', terms: ['oxum', 'osun', 'rio', 'cachoeira'] },
  { id: 'iemanja', label: 'Mar e acolhimento', phrase: 'Acolhimento profundo para toda a corrente.', terms: ['iemanja', 'iemanjá', 'yemanja', 'yemanjá'] },
  { id: 'xango', label: 'Pedra e justiça', phrase: 'Equilíbrio, verdade e firmeza na casa.', terms: ['xango', 'xangô', 'sango', 'justica', 'justiça'] },
  { id: 'caboclo', label: 'Mata e direção', phrase: 'Força da mata, caminho aberto. Que os Caboclos nos guiem.', terms: ['caboclo', 'cabocla', 'mata', 'jurema', 'pena'] },
];

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

function stableVariant(id: string) {
  let value = 0;
  for (let index = 0; index < id.length; index += 1) value = (value * 31 + id.charCodeAt(index)) >>> 0;
  return value % 3;
}

export function resolveGiraVisualTheme(event: DashboardNextEvent | null): GiraVisualTheme {
  const source = normalize(`${event?.titulo || ''} ${event?.tipo || ''} ${event?.descricao || ''}`);
  const match = THEME_RULES.find((rule) => rule.terms.some((term) => source.includes(normalize(term))));
  return {
    id: match?.id || 'default',
    label: match?.label || 'Encontro da comunidade',
    phrase: match?.phrase || 'A casa se prepara para o próximo movimento.',
    variant: stableVariant(String(event?.id || event?.titulo || 'axecloud')),
  };
}
