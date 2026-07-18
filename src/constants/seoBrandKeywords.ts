/** Nome canônico da marca (com acento). */
export const BRAND_NAME = 'AxéCloud' as const;

/** Slogan principal da marca. */
export const BRAND_TAGLINE = 'Gestão de Terreiros de Umbanda e Candomblé' as const;

/** Título comercial para `<title>`, PWA e Open Graph. */
export const SITE_TITLE = `Gestão de Terreiros | ${BRAND_NAME} para Umbanda e Candomblé` as const;

/** Nome público do portal (diretório, conteúdo, terreiros). */
export const PORTAL_BRAND = 'Portal de Gestão AxéCloud' as const;

/**
 * Variações de escrita que as pessoas digitam no Google.
 * Fonte única para meta keywords, JSON-LD alternateName e texto estático.
 */
export const BRAND_ALTERNATE_NAMES = [
  'Ilê Asé',
  'Ilê Ase',
  'Ile Ase',
  'ile ase',
  'axecloud',
  'AxeCloud',
  'axe cloud',
  'Axe Cloud',
  'Axé cloud',
  'Axé Cloud',
] as const;

/** Termos de produto e nicho — complementam as variações da marca. */
export const BRAND_TOPIC_KEYWORDS = [
  'gestão de terreiros',
  'gestão de terreiro',
  'software de gestão de terreiros',
  'sistema de gestão para terreiros',
  'software para terreiro',
  'sistema para terreiro',
  'terreiro digital',
  'casa de axé',
  'zelador',
  'filhos de santo',
  'candomblé',
  'umbanda',
  'jurema',
  'gestão mística',
  'gestão sagrada',
  'financeiro de terreiro',
  'mensalidade terreiro',
  'galeria de fotos terreiro',
  'calendário de giras',
  'portal filho de santo',
  'terreiro umbanda',
  'terreiro candomblé',
] as const;

/** Lista completa para meta name="keywords" (marca + nicho). */
export function buildBrandKeywordsMeta(): string {
  const seen = new Set<string>();
  const parts: string[] = [];

  for (const term of [BRAND_NAME, ...BRAND_ALTERNATE_NAMES, ...BRAND_TOPIC_KEYWORDS]) {
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(term);
  }

  return parts.join(', ');
}

/** alternateName para Organization, WebSite e SoftwareApplication (schema.org). */
export function buildBrandAlternateNamesJsonLd(): string[] {
  return [...BRAND_ALTERNATE_NAMES];
}

/** Parágrafo natural para HTML estático e crawlers — sem keyword stuffing. */
export function buildBrandRecognitionParagraph(): string {
  const spoken =
    BRAND_ALTERNATE_NAMES.slice(0, 5).join(', ') +
    ' e outras grafias';
  return `${BRAND_NAME} (${BRAND_TAGLINE}) é o sistema de gestão para terreiros de Umbanda e Candomblé. Se você buscou por ${spoken}, este é o site oficial em axecloud.com.br.`;
}
