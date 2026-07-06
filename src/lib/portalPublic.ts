export type PublicTerreiro = {
  slug: string;
  nome: string;
  fotoUrl: string | null;
  tradicao: string;
  descricao: string | null;
  cidade: string | null;
  estado: string | null;
  bairro: string | null;
  whatsapp: string | null;
  verificada: boolean;
  destaque: boolean;
  pedidosAtivos: boolean;
  mensagemPedidos: string | null;
  perfilUrl: string | null;
  pedidosUrl: string | null;
  cidadeSlug: string | null;
  visualizacoes?: number;
};

export type PublicEvento = {
  id: string;
  titulo: string;
  data: string;
  hora: string;
  tipo: string;
  descricao: string;
  bannerUrl: string | null;
  senhasAtivas?: boolean;
  eventoPageUrl?: string | null;
  terreiro: {
    nome: string;
    slug: string;
    cidade: string | null;
    estado: string | null;
    perfilUrl: string;
  };
  cidadeSlug: string | null;
};

export type PublicEventoDetail = {
  id: string;
  titulo: string;
  data: string;
  hora: string;
  tipo: string;
  descricao: string;
  bannerUrl: string | null;
  senhasAtivas: boolean;
  senhasEmitidas: number;
  senhasMaximas: number | null;
  senhasRestantes: number | null;
  esgotado: boolean;
  terreiro: {
    nome: string;
    slug: string;
    cidade: string | null;
    estado: string | null;
    perfilUrl: string;
  };
};

export type PublicCidade = {
  slug: string;
  cidade: string;
  estado: string | null;
  count: number;
};

export function terreiroProfilePath(slug: string): string {
  return `/terreiros/${encodeURIComponent(slug)}`;
}

export function terreirosCityPath(citySlug: string): string {
  return `/terreiros/cidade/${encodeURIComponent(citySlug)}`;
}

export function tradicaoLabel(tradicao: string): string {
  switch (tradicao) {
    case 'umbanda':
      return 'Umbanda';
    case 'candomble':
      return 'Candomblé';
    case 'jurema':
      return 'Jurema';
    case 'outra':
      return 'Outra tradição';
    default:
      return 'Tradição mista';
  }
}

export async function fetchPublicTerreiros(params?: {
  page?: number;
  q?: string;
  tradicao?: string;
  cidade?: string;
}): Promise<{ items: PublicTerreiro[]; total: number; page: number }> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.q) qs.set('q', params.q);
  if (params?.tradicao) qs.set('tradicao', params.tradicao);
  if (params?.cidade) qs.set('cidade', params.cidade);
  const res = await fetch(`/api/v1/public/terreiros?${qs}`, { cache: 'no-store' });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erro ao carregar terreiros');
  return json;
}

export async function fetchPublicTerreiro(slug: string): Promise<PublicTerreiro> {
  const res = await fetch(`/api/v1/public/terreiros/${encodeURIComponent(slug)}`, { cache: 'no-store' });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Terreiro não encontrado');
  return json;
}

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

export async function fetchPublicEventos(cidade?: string): Promise<PublicEvento[]> {
  const qs = cidade ? `?cidade=${encodeURIComponent(cidade)}` : '';
  const res = await fetch(`/api/v1/public/eventos${qs}`, { cache: 'no-store' });
  const json = await readApiJson<{ error?: string; items?: PublicEvento[] }>(
    res,
    'Erro ao carregar eventos',
  );
  if (!res.ok) throw new Error(json.error || 'Erro ao carregar eventos');
  return json.items || [];
}

export async function fetchPublicEvento(token: string): Promise<PublicEventoDetail> {
  const res = await fetch(`/api/v1/public/evento/${encodeURIComponent(token)}`, { cache: 'no-store' });
  const json = await readApiJson<{ error?: string } & PublicEventoDetail>(
    res,
    'Evento não encontrado',
  );
  if (!res.ok) throw new Error(json.error || 'Evento não encontrado');
  return json;
}

export async function fetchPublicCidades(): Promise<PublicCidade[]> {
  const res = await fetch('/api/v1/public/terreiros/cidades', { cache: 'no-store' });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erro ao carregar cidades');
  return json.cidades || [];
}
