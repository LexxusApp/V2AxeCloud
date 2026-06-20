export type LandingTestimonial = {
  id: string;
  quote: string;
  authorName: string;
  authorRole?: string;
  houseName?: string;
  city: string;
  state: string;
};

export const LANDING_TESTIMONIALS_HEADING = {
  kicker: 'Depoimentos',
  title: 'O que dirigentes dizem sobre o Ilê Asé',
  lead: 'Casas espirituais que usam o Ilê Asé para organizar a rotina com mais clareza e respeito à tradição.',
} as const;

/**
 * Fallback editorial enquanto não há depoimentos publicados no banco (`depoimento_publicado`).
 * Substitua por citações reais autorizadas via admin/Supabase.
 */
export const LANDING_TESTIMONIALS_FALLBACK: readonly LandingTestimonial[] = [
  {
    id: 'fallback-1',
    quote:
      'O financeiro com Pix e o mural de avisos já mudaram nossa rotina. A diretoria enxerga mensalidades e comunicados num painel só, sem depender só de grupos.',
    authorName: 'Zeladora',
    authorRole: 'Programa Fundador',
    houseName: 'Casa de axé — Grande SP',
    city: 'São Paulo',
    state: 'SP',
  },
  {
    id: 'fallback-2',
    quote:
      'Consigo ver as giras no celular e pagar a mensalidade com praticidade. O portal do filho de santo deixa tudo mais claro para quem participa da casa.',
    authorName: 'Filha de santo',
    authorRole: 'Portal da comunidade',
    houseName: 'Terreiro parceiro',
    city: 'Suzano',
    state: 'SP',
  },
  {
    id: 'fallback-3',
    quote:
      'A galeria e o calendário ajudaram a guardar a memória das festas com organização. Para quem cuida da casa, faz diferença ter tudo centralizado.',
    authorName: 'Diretoria',
    authorRole: 'Gestão da casa',
    houseName: 'Ilê em validação',
    city: 'Interior',
    state: 'SP',
  },
] as const;
