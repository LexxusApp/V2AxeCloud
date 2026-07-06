export type DiretorioEstabelecimentoTipo = 'terreiro' | 'loja';

export type DiretorioTerreiro = {
  slug: string;
  nome: string;
  endereco: string | null;
  telefone: string | null;
  fotoUrl: string | null;
  linkMaps: string | null;
  cidade: string | null;
  estado: string | null;
  cidadeSlug: string | null;
  bairro: string | null;
  bairroSlug: string | null;
  tipo: DiretorioEstabelecimentoTipo;
  perfilUrl: string | null;
  cidadeUrl: string | null;
};

export type DiretorioBairroGroup = {
  nome: string;
  slug: string;
  total: number;
  items: DiretorioTerreiro[];
};

export type DiretorioCidade = {
  cidade: string;
  estado: string | null;
  cidadeSlug: string;
  count: number;
};

async function readApiJson<T>(res: Response, fallbackError: string): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(res.ok ? fallbackError : 'Servidor indisponível. Tente novamente em instantes.');
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(res.ok ? fallbackError : 'Servidor indisponível. Tente novamente em instantes.');
  }
}

export async function fetchDiretorioCidades(): Promise<DiretorioCidade[]> {
  const res = await fetch('/api/v1/public/diretorio/cidades', { cache: 'no-store' });
  const json = await readApiJson<{ error?: string; cidades?: DiretorioCidade[] }>(
    res,
    'Erro ao carregar cidades',
  );
  if (!res.ok) throw new Error(json.error || 'Erro ao carregar cidades');
  return json.cidades || [];
}

export async function fetchDiretorioCidade(
  estado: string,
  cidadeSlug: string,
): Promise<{
  cidade: string;
  estado: string | null;
  cidadeSlug: string;
  total: number;
  totalTerreiros: number;
  totalLojas: number;
  items: DiretorioTerreiro[];
  bairros?: DiretorioBairroGroup[];
}> {
  const res = await fetch(
    `/api/v1/public/diretorio/${encodeURIComponent(estado)}/${encodeURIComponent(cidadeSlug)}`,
    { cache: 'no-store' },
  );
  const json = await readApiJson<{ error?: string } & Awaited<ReturnType<typeof fetchDiretorioCidade>>>(
    res,
    'Erro ao carregar terreiros',
  );
  if (!res.ok) throw new Error(json.error || 'Erro ao carregar terreiros');
  return json;
}

export async function fetchDiretorioTerreiro(slug: string): Promise<DiretorioTerreiro> {
  const res = await fetch(`/api/v1/public/diretorio/terreiro/${encodeURIComponent(slug)}`, {
    cache: 'no-store',
  });
  const json = await readApiJson<{ error?: string } & DiretorioTerreiro>(res, 'Terreiro não encontrado');
  if (!res.ok) throw new Error(json.error || 'Terreiro não encontrado');
  return json;
}
