import type { GiraScheduleItem } from '../../lib/giraSchedule';

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
  verificada: boolean;
  indexable?: boolean;
  perfilUrl: string | null;
  cidadeUrl: string | null;
  horariosGira?: GiraScheduleItem[];
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

const DIRECTORY_VISITOR_KEY = 'axecloud_public_vid';
const DIRECTORY_ATTRIBUTION_KEY = 'axecloud_directory_attribution';

type DirectoryAttribution = {
  referrer: string | null;
  source: string | null;
  medium: string | null;
  landingPath: string;
  google: boolean;
};

function isGoogleReferrer(referrer: string): boolean {
  try {
    const hostname = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '');
    return hostname === 'google.com' || hostname.startsWith('google.') || hostname.endsWith('.google.com');
  } catch {
    return false;
  }
}

function directoryVisitorId(): string {
  const current = localStorage.getItem(DIRECTORY_VISITOR_KEY);
  if (current && /^[0-9a-f-]{36}$/i.test(current)) return current;
  const created = crypto.randomUUID();
  localStorage.setItem(DIRECTORY_VISITOR_KEY, created);
  return created;
}

function directoryAttribution(): DirectoryAttribution {
  const params = new URLSearchParams(window.location.search);
  const referrer = document.referrer || '';
  const utmSource = (params.get('utm_source') || '').toLowerCase();
  const utmMedium = (params.get('utm_medium') || '').toLowerCase();
  const fromGoogle = isGoogleReferrer(referrer) || utmSource === 'google' || utmSource === 'google_ads';
  const fresh: DirectoryAttribution = {
    referrer: referrer || null,
    source: utmSource || (fromGoogle ? 'google' : null),
    medium: utmMedium || (params.has('gclid') ? 'cpc' : fromGoogle ? 'organic' : null),
    landingPath: `${window.location.pathname}${window.location.search}`.slice(0, 500),
    google: fromGoogle,
  };
  if (fresh.google) {
    sessionStorage.setItem(DIRECTORY_ATTRIBUTION_KEY, JSON.stringify(fresh));
    return fresh;
  }
  try {
    const stored = sessionStorage.getItem(DIRECTORY_ATTRIBUTION_KEY);
    return stored ? { ...fresh, ...JSON.parse(stored) as DirectoryAttribution } : fresh;
  } catch {
    return fresh;
  }
}

function directoryTrackingPayload() {
  return { ...directoryAttribution(), visitorId: directoryVisitorId() };
}

/** Best-effort: não bloqueia a navegação para o perfil. */
export function trackDiretorioProfileClick(slug: string): void {
  const normalized = String(slug || '').trim();
  if (!normalized) return;
  void fetch(`/api/v1/public/diretorio/terreiro/${encodeURIComponent(normalized)}/profile-click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify(directoryTrackingPayload()),
  }).catch(() => undefined);
}

/** Conta uma vez por sessão/dia a entrada direta do Google no perfil público. */
export function trackDiretorioGoogleProfileView(slug: string): void {
  const normalized = String(slug || '').trim();
  if (!normalized) return;
  const attribution = directoryAttribution();
  if (!attribution.google) return;
  const marker = `axecloud_google_profile:${new Date().toISOString().slice(0, 10)}:${normalized}`;
  if (sessionStorage.getItem(marker)) return;
  void fetch(`/api/v1/public/diretorio/terreiro/${encodeURIComponent(normalized)}/google-view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ ...attribution, visitorId: directoryVisitorId() }),
  }).then((response) => {
    if (response.ok) sessionStorage.setItem(marker, '1');
  }).catch(() => undefined);
}

export type TerreiroServico = {
  id: string;
  nome: string;
  descricao: string | null;
  duracao_minutos: number | null;
  valor_min: number | null;
  valor_max: number | null;
  ordem: number;
};

export type TerreiroServicosPublic = {
  servicos: TerreiroServico[];
  whatsappAtendimento: string | null;
};

export async function fetchDiretorioTerreiroServicos(slug: string): Promise<TerreiroServicosPublic> {
  try {
    const res = await fetch(`/api/v1/public/diretorio/terreiro/${encodeURIComponent(slug)}/servicos`, {
      cache: 'no-store',
    });
    if (!res.ok) return { servicos: [], whatsappAtendimento: null };
    const json = await readApiJson<TerreiroServicosPublic & { error?: string }>(res, '');
    return { servicos: json.servicos || [], whatsappAtendimento: json.whatsappAtendimento || null };
  } catch {
    return { servicos: [], whatsappAtendimento: null };
  }
}
