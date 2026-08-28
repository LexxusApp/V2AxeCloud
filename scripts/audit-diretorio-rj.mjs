import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error("Faltam SUPABASE_URL/VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function municipalityFromAddress(address, state) {
  const raw = String(address || "");
  const escapedState = String(state || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!escapedState) return null;
  const standard = raw.match(new RegExp(`,\\s*([^,]+?)\\s*-\\s*${escapedState}(?=,|$)`, "i"));
  const alternate = raw.match(new RegExp(`-\\s*([^,]+?),\\s*${escapedState}(?=,|$)`, "i"));
  return String(standard?.[1] || alternate?.[1] || "").trim() || null;
}

const commercialName =
  /\b(casa\s+de\s+velas|loja\s+do\s+axe|artigos?\s+religiosos?|bazar|distribuidora|tabacaria|adega|restaurante|buffet|museu|museumbanda|cia\.?\s+cultural|prefeitura|camara\s+municipal|secretaria\s+municipal|escola\s+de\s+atabaque|terreiro\s+de\s+ideias|confraria\s+do\s+impossivel)\b/i;
const axeEvidence =
  /\b(umband(?:a|ista)|catobandista|candomble|quimbanda|terreiro|tenda|jurema|afro|orixa|babalorixa|ialorixa|caboclo|exu|vodun|nago|axe|ase|ile|ilesin|inzo|abassa|barracao|egbe|kwe|hunkpame|pai|mae|ogum|oxossi|oxum|xango|iemanja|iansa|oya|oxala|omolu|obaluae|nana|pombagira|preto\s+velho|vovo|boiadeiro|ze\s+pelintra|maria\s+(?:mulambo|padilha)|sete\s+flechas|tupinamba|aruanda|angola|congo|guine|falangeiros?|eres?)\b/i;

async function fetchAllRioRows() {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("terreiros_diretorio")
      .select("id,nome,slug,cidade,estado,endereco,link_maps,latitude,longitude")
      .eq("estado", "RJ")
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < pageSize) break;
  }
  return rows;
}

function duplicateGroups(rows, keyFor) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFor(row);
    if (!key) continue;
    const group = groups.get(key) || [];
    group.push(row);
    groups.set(key, group);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

const rows = await fetchAllRioRows();
const cityCounts = Object.entries(
  rows.reduce((counts, row) => {
    counts[row.cidade] = (counts[row.cidade] || 0) + 1;
    return counts;
  }, {}),
).sort((a, b) => b[1] - a[1]);

const municipalityMismatch = rows.filter((row) => {
  const municipality = municipalityFromAddress(row.endereco, row.estado);
  return municipality && normalize(municipality) !== normalize(row.cidade);
});
const stateMismatch = rows.filter((row) => {
  const explicitStates = [...String(row.endereco || "").matchAll(/-\s*([A-Z]{2})(?=,|$)/g)].map(
    (match) => match[1],
  );
  return explicitStates.length > 0 && !explicitStates.includes(row.estado);
});
const unverifiableMunicipality = rows.filter(
  (row) => !municipalityFromAddress(row.endereco, row.estado),
);
const cityPlaceholder = rows.filter((row) => normalize(row.nome) === normalize(row.cidade));
const commercialCandidates = rows.filter((row) => commercialName.test(normalize(row.nome)));
const needsManualContextReview = rows.filter((row) => !axeEvidence.test(normalize(row.nome)));
const streetViewLinks = rows.filter((row) => /\/maps\/@.*(?:,3a,|!1e1)/i.test(row.link_maps || ""));
const incomplete = rows.filter(
  (row) =>
    !row.nome ||
    !row.slug ||
    !row.cidade ||
    !row.estado ||
    !row.link_maps ||
    row.latitude == null ||
    row.longitude == null,
);
const duplicateLinks = duplicateGroups(rows, (row) => normalize(row.link_maps));
const duplicateIdentity = duplicateGroups(
  rows,
  (row) => `${normalize(row.cidade)}|${normalize(row.nome)}|${normalize(row.endereco)}`,
);

console.log(
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      total: rows.length,
      citiesWithListings: cityCounts.length,
      cityCounts,
      issues: {
        municipalityMismatch,
        stateMismatch,
        unverifiableMunicipality,
        cityPlaceholder,
        commercialCandidates,
        needsManualContextReview,
        streetViewLinks,
        incomplete,
        duplicateLinks,
        duplicateIdentity,
      },
      issueCounts: {
        municipalityMismatch: municipalityMismatch.length,
        stateMismatch: stateMismatch.length,
        unverifiableMunicipality: unverifiableMunicipality.length,
        cityPlaceholder: cityPlaceholder.length,
        commercialCandidates: commercialCandidates.length,
        needsManualContextReview: needsManualContextReview.length,
        streetViewLinks: streetViewLinks.length,
        incomplete: incomplete.length,
        duplicateLinks: duplicateLinks.length,
        duplicateIdentity: duplicateIdentity.length,
      },
    },
    null,
    2,
  ),
);
