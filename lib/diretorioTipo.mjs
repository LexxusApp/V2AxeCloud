/** Classifica estabelecimento do diretório: terreiro vs loja (artigos religiosos). */

/** @typedef {'terreiro' | 'loja'} DiretorioEstabelecimentoTipo */

const LOJA_RE = [
  /\bloja\b/i,
  /\bartigos?\s+religios/i,
  /\bartigos?\s+m[ií]stic/i,
  /\bartigos?\s+de\s+umbanda\b/i,
  /\bartigos?\s+afro\b/i,
  /\bshopping\b/i,
  /\bdep[óo]sito\b/i,
  /\bdistribuidor/i,
  /\bimportador/i,
  /\batacad/i,
  /\besot[eé]ric/i,
  /\bimagens?\s+religios/i,
  /\bbotica\b/i,
  /\bpapelaria\b/i,
  /\bvelas?\s+(de|e|sorocaba|santos)/i,
  /\bvelas?\b/i,
  /\bcasa\s+das\s+velas/i,
  /\bcasa\s+do\s+cigano/i,
  /\bcasa\s+do\s+ax[eé]\s+(sorocaba|loja|unidade)/i,
  /\b7\s*folhas\b/i,
  /\bile[\s-]?ax[eé]\s+\w+\s+artigos/i,
  /\bax[eé]\s+\w+\s+artigos/i,
  /\bartigos\s+e\s+esot[eé]ric/i,
  /\bprodutos?\s+religios/i,
  /\bdefumador/i,
  /\bcharutos?\s+e\s+defumador/i,
];

const TERREIRO_RE = [
  /\bterreiro\b/i,
  /\btemplo\b/i,
  /\btenda\b/i,
  /\bcasa\s+de\s+(umbanda|candombl[eé])/i,
  /\bcentro\s+esp[ií]rita\b/i,
  /\bumbanda\b/i,
  /\bcandombl[eé]\b/i,
  /\bil[eê][\s-]?(ase|ax[eé])\b/i,
  /\bquimbanda\b/i,
  /\bn[uú]cleo\s+esp[ií]rita\b/i,
  /\b(?:pai|m[aã]e)\s+[a-záàâãéêíóôõúç]/i,
  /\bcaboclo\b/i,
  /\borix[aá]s?\b/i,
];

function normalize(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * @param {string} nome
 * @param {string | null | undefined} [categoriaMaps]
 * @returns {DiretorioEstabelecimentoTipo}
 */
export function classifyDiretorioEstabelecimento(nome, categoriaMaps) {
  const n = String(nome || "").trim();
  if (!n) return "terreiro";

  const cat = normalize(categoriaMaps);
  if (cat.includes("loja") || cat.includes("store") || cat.includes("shop")) return "loja";
  if (cat.includes("templo") || cat.includes("terreiro")) return "terreiro";

  for (const re of TERREIRO_RE) {
    if (re.test(n)) {
      if (/\bartigos?\s+religios/i.test(n) || /\bloja\b/i.test(n)) continue;
      return "terreiro";
    }
  }

  for (const re of LOJA_RE) {
    if (re.test(n)) return "loja";
  }

  if (/\bcasa\s+do\s+ax[eé]\b/i.test(n) && !/\b(umbanda|candombl|templo|terreiro|tenda)\b/i.test(n)) {
    return "loja";
  }

  return "terreiro";
}

/**
 * @param {unknown} stored
 * @param {string} nome
 * @param {string | null | undefined} [categoriaMaps]
 * @returns {DiretorioEstabelecimentoTipo}
 */
export function resolveDiretorioTipo(stored, nome, categoriaMaps) {
  const t = String(stored || "").trim().toLowerCase();
  if (t === "loja" || t === "terreiro") return t;
  return classifyDiretorioEstabelecimento(nome, categoriaMaps);
}
