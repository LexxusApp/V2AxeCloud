import type { DiretorioBairroGroup, DiretorioCidade, DiretorioTerreiro } from './diretorioPublic';
import { fetchDiretorioCidade, fetchDiretorioCidades } from './diretorioPublic';

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

declare global {
  interface Window {
    __AXECLOUD_DIRECTORY_SUMMARY__?: DiretorioCidadeResumo[];
  }
}

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

export function readEmbeddedDiretorioCidadesResumo(): DiretorioCidadeResumo[] {
  if (typeof window === 'undefined' || !Array.isArray(window.__AXECLOUD_DIRECTORY_SUMMARY__)) {
    return [];
  }
  return window.__AXECLOUD_DIRECTORY_SUMMARY__.filter(isCidadeResumo);
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

/** Lista de cidades: JSON estático (rápido) ou API (2000+ terreiros no Supabase). */
export async function loadDiretorioCidadesResumo(signal?: AbortSignal): Promise<DiretorioCidadeResumo[]> {
  const snapshot = await fetchDiretorioCidadesSnapshot(signal);
  if (snapshot?.length) return snapshot;

  const cidades = await fetchDiretorioCidades();
  if (!cidades.length) return [];

  return cidades.map((cidade) => ({
    ...cidade,
    total: cidade.count,
    totalTerreiros: cidade.count,
    totalBairros: 0,
  }));
}

function itemsToBairros(items: DiretorioTerreiro[]): DiretorioBairroGroup[] {
  if (!items.length) return [];
  return [
    {
      nome: 'Todos os terreiros',
      slug: 'todos',
      total: items.length,
      items,
    },
  ];
}

/** Detalhe da cidade: snapshot JSON ou API pública. */
export async function loadDiretorioCidadeDetail(
  estado: string,
  cidadeSlug: string,
  signal?: AbortSignal,
): Promise<DiretorioCidadeSnapshot | null> {
  const snapshot = await fetchDiretorioCidadeSnapshot(estado, cidadeSlug, signal);
  if (snapshot) return snapshot;

  try {
    const api = await fetchDiretorioCidade(estado, cidadeSlug);
    const bairros =
      api.bairros && api.bairros.length > 0 ? api.bairros : itemsToBairros(api.items || []);

    return {
      cidade: api.cidade,
      estado: api.estado,
      cidadeSlug: api.cidadeSlug,
      count: api.total,
      total: api.total,
      totalTerreiros: api.totalTerreiros,
      bairros,
    };
  } catch {
    return null;
  }
}
