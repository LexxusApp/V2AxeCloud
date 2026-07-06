import type { DiretorioBairroGroup, DiretorioCidade, DiretorioTerreiro } from './diretorioPublic';

export type DiretorioCidadeResumo = DiretorioCidade & {
  total: number;
  totalTerreiros: number;
  totalBairros: number;
};

export type DiretorioCidadeSnapshot = DiretorioCidade & {
  total: number;
  totalTerreiros: number;
  bairros: DiretorioBairroGroup[];
  error?: string;
};

type DiretorioCidadesSnapshot = {
  cidades?: DiretorioCidadeResumo[];
};

type DiretorioSnapshot = {
  cidades?: DiretorioCidadeSnapshot[];
};

function isCidadeResumo(value: unknown): value is DiretorioCidadeResumo {
  if (!value || typeof value !== 'object') return false;
  const cidade = value as Partial<DiretorioCidadeResumo>;
  return Boolean(cidade.cidade && cidade.cidadeSlug && typeof cidade.totalTerreiros === 'number');
}

function isCidadeSnapshot(value: unknown): value is DiretorioCidadeSnapshot {
  if (!value || typeof value !== 'object') return false;
  const cidade = value as Partial<DiretorioCidadeSnapshot>;
  return Boolean(cidade.cidade && cidade.cidadeSlug && Array.isArray(cidade.bairros));
}

export async function fetchDiretorioCidadesSnapshot(signal?: AbortSignal): Promise<DiretorioCidadeResumo[] | null> {
  const res = await fetch('/diretorio-cidades.json', { cache: 'no-cache', signal });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text.trim()) return null;
  let json: DiretorioCidadesSnapshot;
  try {
    json = JSON.parse(text) as DiretorioCidadesSnapshot;
  } catch {
    return null;
  }
  const cidades = Array.isArray(json.cidades) ? json.cidades.filter(isCidadeResumo) : [];
  return cidades.length > 0 ? cidades : null;
}

export async function fetchDiretorioSnapshot(signal?: AbortSignal): Promise<DiretorioCidadeSnapshot[] | null> {
  const res = await fetch('/diretorio-snapshot.json', { cache: 'no-cache', signal });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text.trim()) return null;
  let json: DiretorioSnapshot;
  try {
    json = JSON.parse(text) as DiretorioSnapshot;
  } catch {
    return null;
  }
  const cidades = Array.isArray(json.cidades) ? json.cidades.filter(isCidadeSnapshot) : [];
  return cidades.length > 0 ? cidades : null;
}

export async function fetchDiretorioCidadeSnapshot(
  estado: string,
  cidadeSlug: string,
  signal?: AbortSignal,
): Promise<DiretorioCidadeSnapshot | null> {
  const cidades = await fetchDiretorioSnapshot(signal);
  const uf = estado.toLowerCase();
  return (
    cidades?.find((cidade) => cidade.cidadeSlug === cidadeSlug && (cidade.estado || '').toLowerCase() === uf) ||
    cidades?.find((cidade) => cidade.cidadeSlug === cidadeSlug) ||
    null
  );
}

export function flattenCidadeTerreiros(cidade: DiretorioCidadeSnapshot): DiretorioTerreiro[] {
  return cidade.bairros.flatMap((bairro) => bairro.items);
}
