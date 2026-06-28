/** Extração e slug de bairro — diretório terreiros (SP capital e região). */

export const SAO_PAULO_CIDADE = "São Paulo";

/** Bairros/distritos conhecidos da Zona Leste e entorno (normalizado para match). */
export const BAIRROS_SP_CONHECIDOS: readonly string[] = [
  "Itaim Paulista",
  "São Miguel Paulista",
  "Cidade Tiradentes",
  "Guaianazes",
  "Ermelino Matarazzo",
  "Penha",
  "Vila Prudente",
  "Sapopemba",
  "São Mateus",
  "Itaquera",
  "Cidade Líder",
  "José Bonifácio",
  "Iguatemi",
  "Lajeado",
  "Cidade Kemel",
  "Vila Curuçá",
  "Vila Jacuí",
  "Parque do Carmo",
  "Tatuapé",
  "Mooca",
  "Brás",
  "Belém",
  "Carrão",
  "Vila Formosa",
  "Aricanduva",
  "Cidade Ademar",
  "Capão Redondo",
  "Campo Limpo",
  "Santo Amaro",
  "Ipiranga",
  "Sacomã",
  "Jabaquara",
];

function normalizeForMatch(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function slugifyBairro(raw: string, maxLen = 60): string {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen);
}

/** Tenta extrair bairro de endereço no formato Google Maps (SP). */
export function extractBairroFromEndereco(
  endereco: string | null | undefined,
  cidade: string | null | undefined = SAO_PAULO_CIDADE,
): string | null {
  const addr = String(endereco || "").trim();
  if (!addr) return null;

  const cidadeNorm = normalizeForMatch(cidade || SAO_PAULO_CIDADE);

  for (const b of BAIRROS_SP_CONHECIDOS) {
    if (normalizeForMatch(addr).includes(normalizeForMatch(b))) return b;
  }

  if (cidadeNorm.includes("sao paulo")) {
    const dashMatch = addr.match(/-\s*([^,]+),\s*S[aã]o Paulo/i);
    if (dashMatch) {
      const candidate = dashMatch[1].trim();
      if (candidate.length >= 3 && candidate.length <= 80 && !/^\d/.test(candidate)) {
        return candidate;
      }
    }

    const parts = addr.split(",").map((p) => p.trim());
    for (let i = 0; i < parts.length; i++) {
      if (/^S[aã]o Paulo/i.test(parts[i]) && i > 0) {
        const prev = parts[i - 1].replace(/^-\s*/, "").trim();
        if (
          prev.length >= 3 &&
          prev.length <= 80 &&
          !/^\d/.test(prev) &&
          !/\d{5}-?\d{3}/.test(prev) &&
          !/^R\.|^Av\.|^Al\.|^Trav\./i.test(prev)
        ) {
          return prev;
        }
      }
    }
  }

  return null;
}

export function resolveTerreiroBairro(input: {
  bairro?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  scrapeLabel?: string | null;
  scrapeCidade?: string | null;
}): string | null {
  const stored = String(input.bairro || "").trim();
  if (stored) return stored;

  const label = String(input.scrapeLabel || "").trim();
  const scrapeCidade = String(input.scrapeCidade || "").trim();
  if (label && scrapeCidade && normalizeForMatch(label) !== normalizeForMatch(scrapeCidade)) {
    return label;
  }

  return extractBairroFromEndereco(input.endereco, input.cidade);
}

export type DiretorioBairroGroup<T> = {
  nome: string;
  slug: string;
  total: number;
  items: T[];
};

export function groupItemsByBairro<T extends { bairro?: string | null; nome?: string }>(
  items: T[],
  outrosLabel = "Outros bairros",
): DiretorioBairroGroup<T>[] {
  const map = new Map<string, T[]>();

  for (const item of items) {
    const nome = String(item.bairro || "").trim() || outrosLabel;
    const list = map.get(nome) || [];
    list.push(item);
    map.set(nome, list);
  }

  return [...map.entries()]
    .map(([nome, groupItems]) => ({
      nome,
      slug: slugifyBairro(nome) || "outros",
      total: groupItems.length,
      items: groupItems.sort((a, b) =>
        String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"),
      ),
    }))
    .sort((a, b) => {
      if (a.nome === outrosLabel) return 1;
      if (b.nome === outrosLabel) return -1;
      return b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR");
    });
}

/** Agrupa por bairro quando faz sentido (SP capital ou 2+ bairros distintos). */
export function shouldGroupCityByBairro(
  cidadeSlug: string,
  items: { bairro?: string | null }[],
): boolean {
  if (slugifyBairro(cidadeSlug) === "sao-paulo" && items.length >= 5) return true;
  const distinct = new Set(items.map((i) => String(i.bairro || "").trim()).filter(Boolean));
  return distinct.size >= 2;
}
