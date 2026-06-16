/** Calendário litúrgico de referência (T4) — datas comuns; cada casa tem calendário próprio. */
export type LiturgicalDate = {
  day: string;
  title: string;
  note?: string;
};

export type LiturgicalMonth = {
  month: string;
  dates: LiturgicalDate[];
};

export const LITURGICAL_CALENDAR_MONTHS: LiturgicalMonth[] = [
  {
    month: 'Janeiro',
    dates: [
      { day: '1º', title: 'Ano novo — trabalhos de abertura e firma', note: 'Muitas casas iniciam o ano com limpeza espiritual.' },
      { day: '6', title: 'Dia de Reis / Epifania', note: 'Celebrações ligadas a Oxalá, Iemanjá ou linhas de preto velho conforme a casa.' },
    ],
  },
  {
    month: 'Fevereiro',
    dates: [
      { day: '2', title: 'Iemanjá (2 de fevereiro)', note: 'Festa popular e obrigações em casas de axé litorâneas e urbanas.' },
      { day: 'Variável', title: 'Carnaval', note: 'Período de restrições em muitas casas; consulte a diretoria local.' },
    ],
  },
  {
    month: 'Março',
    dates: [{ day: '19', title: 'São José / Oxossi (em várias linhas)', note: 'Toques e festas conforme nação e firma.' }],
  },
  {
    month: 'Abril',
    dates: [{ day: 'Variável', title: 'Semana Santa', note: 'Respeito ao silêncio ritual; algumas casas não realizam giras abertas.' }],
  },
  {
    month: 'Maio',
    dates: [
      { day: '13', title: 'Aparição / trabalhos de Oxalá', note: 'Comum em casas com forte linha de Oxalá e preto velho.' },
      { day: 'Mês', title: 'Mês de Maria / linhas de caboclo', note: 'Rosários e trabalhos de cura em diversas casas de Umbanda.' },
    ],
  },
  {
    month: 'Junho',
    dates: [
      { day: '13', title: 'Santo Antônio', note: 'Trabalhos de demanda e firma em algumas linhas.' },
      { day: '24', title: 'São João', note: 'Fogueiras e festas juninas integradas ao axé em várias regiões.' },
      { day: '29', title: 'São Pedro', note: 'Celebrações populares e toques em casas de beira de rio.' },
    ],
  },
  {
    month: 'Julho',
    dates: [{ day: '26', title: 'São Cosme e Damião / Erês', note: 'Festa muito presente na Umbanda brasileira.' }],
  },
  {
    month: 'Agosto',
    dates: [{ day: '15', title: 'Nossa Senhora da Assunção / Oxum (conforme casa)', note: 'Obrigações e festas de Oxum em diversas nações.' }],
  },
  {
    month: 'Setembro',
    dates: [{ day: '7', title: 'Independência / trabalhos de nação', note: 'Algumas casas realizam giras abertas com foco comunitário.' }],
  },
  {
    month: 'Outubro',
    dates: [
      { day: '12', title: 'Nossa Senhora Aparecida', note: 'Grande festa popular; muitas casas de Umbanda e Candomblé.' },
      { day: '31', title: 'Dia das almas / finados', note: 'Trabalhos com linhas de pretos velhos e eguns.' },
    ],
  },
  {
    month: 'Novembro',
    dates: [{ day: '2', title: 'Finados', note: 'Memória aos ancestrais; giras de egun e preto velho.' }],
  },
  {
    month: 'Dezembro',
    dates: [
      { day: '4', title: 'Oxalá / Mercurial (algumas casas)', note: 'Início de período de recolhimento em várias tradições.' },
      { day: '8', title: 'Nossa Senhora da Conceição / Iemanjá (algumas casas)', note: 'Confirme com sua casa o dia principal de Iemanjá.' },
      { day: '17', title: 'Dia de Oxalá (muitas casas)', note: 'Roupa branca, silêncio e trabalhos de paz.' },
      { day: '25', title: 'Natal', note: 'Período de recolhimento em diversas casas até o reveillon de axé.' },
    ],
  },
];

export const LITURGICAL_CALENDAR_PATH = '/conteudo/calendario-liturgico';
