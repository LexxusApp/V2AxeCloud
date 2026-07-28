/** Regras compartilhadas de qualidade para páginas públicas do diretório. */

export type DiretorioQualityInput = {
  nome?: unknown;
  slug?: unknown;
  cidade?: unknown;
  estado?: unknown;
  endereco?: unknown;
  telefone?: unknown;
  foto_url?: unknown;
  fotoUrl?: unknown;
  link_maps?: unknown;
  linkMaps?: unknown;
  tipo?: unknown;
};

const AXE_CONTEXT_RE =
  /\b(umbanda|candomble|quimbanda|terreiro|tenda|jurema|afro|orixa|caboclo|exu|vodun|nago|axe|ase|ile|abassa|barracao|egbe|kwe|hunkpame|nzo|pai|mae|ogum|oxossi|oxum|xango|iemanja|iansa|oya|oxala|omolu|obaluae|nan[ãa]|pombagira|preto\s+velho|vovo|boiadeiro|ze\s+pelintra|sete\s+flechas|marias)\b/i;

const CLEARLY_OUT_OF_SCOPE_RE =
  /\b(racionalismo\s+cristao|allan?\s+kardec|kardecista|paroquia|catolic|evangelic|adventista|igreja\s+sant[ao]|igreja\s+universal|testemunhas?\s+de\s+jeova|ministerio\s+extrema|projeto\s+refugio|mesquita|mosque|islam|muculman|budista|sinagoga|templarios?|maconaria|igreja\b|capela\b|catedral\b)\b/i;
const COMMERCIAL_SERVICE_RE =
  /\b(especialista\s+em\s+uniao\s+de\s+casais|consulta\s+com|jogo\s+de\s+buzios\s*[-–—]|amarracao\s+amorosa|trabalhos?\s+amorosos?|cartomante|tarolog[oa]|vidente)\b/i;
const INVALID_PLACE_NAME_RE =
  /^(proximo\s+a)\b|^(casa|centro|sitio|templo|terreiro)$|\b(prefeitura|camara\s+municipal|secretaria\s+municipal|escola\s+de\s+atabaque)\b|\bterreiro\s+cultural\b|\bterreiro\s+de\s+ideias\b|\bconfraria\s+do\s+impossivel\b|^centro\s+espirita\s+de\s+valenca\b/i;
const CLEARLY_COMMERCIAL_PLACE_RE =
  /\b(casa\s+(da|das|de)\s+velas|loja\b|artigos?\s+religiosos?|bazar|distribuidora|tabacaria|adega|restaurante|buffet|museu|museumbanda|cia\.?\s+cultural|pompeia|axogun|merlin)\b/i;

function normalize(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function hasAxeContextInName(value: unknown): boolean {
  return AXE_CONTEXT_RE.test(normalize(value));
}

export function isValidDiretorioName(value: unknown): boolean {
  const nome = String(value || '').trim();
  const meaningful = nome.replace(/[^\p{L}\p{N}]/gu, '');
  return meaningful.length >= 3;
}

export function isClearlyOutsideDiretorioScope(value: unknown): boolean {
  const nome = normalize(value);
  if (
    COMMERCIAL_SERVICE_RE.test(nome) ||
    CLEARLY_COMMERCIAL_PLACE_RE.test(nome) ||
    INVALID_PLACE_NAME_RE.test(nome)
  ) {
    return true;
  }
  // Religiões/locais fora do axé: bloqueia mesmo se houver palavra "casa" etc.
  if (CLEARLY_OUT_OF_SCOPE_RE.test(nome) && !AXE_CONTEXT_RE.test(nome)) {
    return true;
  }
  // Mesquita/islam/igreja genérica: sempre fora, mesmo com nome composto
  if (/\b(mesquita|mosque|islam|muculman)\b/i.test(nome)) {
    return true;
  }
  return false;
}

/**
 * Evita publicar/indexar registros quebrados ou claramente fora do foco.
 * Registros incompletos, mas plausíveis, continuam visíveis para poderem ser reivindicados.
 */
export function isDiretorioListingPublishable(row: DiretorioQualityInput): boolean {
  const slug = String(row.slug || '').trim();
  const cidade = String(row.cidade || '').trim();
  const estado = String(row.estado || '').trim();
  const endereco = String(row.endereco || '').trim();
  const linkMaps = String(row.link_maps || row.linkMaps || '').trim();

  return Boolean(
    slug &&
      cidade &&
      estado &&
      normalize(row.nome) !== normalize(cidade) &&
      (endereco || linkMaps) &&
      isValidDiretorioName(row.nome) &&
      !isClearlyOutsideDiretorioScope(row.nome),
  );
}

/**
 * Critério mais rigoroso para sitemap + robots index.
 * Thin / genérico permanece no site (reivindicação) com noindex.
 */
export function isDiretorioListingIndexable(row: DiretorioQualityInput): boolean {
  if (!isDiretorioListingPublishable(row)) return false;

  const endereco = String(row.endereco || '').trim();
  const telefone = String(row.telefone || '').trim();
  const foto = String(row.foto_url || row.fotoUrl || '').trim();
  const hasAxeSignal = hasAxeContextInName(row.nome);

  // Precisa de endereço real (não só pin do Maps) + sinal de qualidade
  if (!endereco || endereco.length < 12) return false;
  if (!(telefone || foto || hasAxeSignal)) return false;

  return true;
}
