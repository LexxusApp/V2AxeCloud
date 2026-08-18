export type DiretorioMapPoint = {
  slug: string;
  nome: string;
  cidade: string;
  estado: string;
  perfilUrl: string;
  lat: number;
  lng: number;
  verificada: boolean;
  instagramUrl: string | null;
};

type DiretorioMapPayloadV1 = { points?: unknown[]; totals?: { listed?: number; exact?: number } };
type DiretorioMapPayloadV2 = {
  v: 2;
  t?: { listed?: number; exact?: number };
  cities?: string[];
  ufs?: string[];
  s?: string[];
  n?: string[];
  c?: number[];
  e?: number[];
  a?: number[];
  o?: number[];
  r?: number[];
  i?: string[];
};

function isMapPoint(value: unknown): value is DiretorioMapPoint {
  if (!value || typeof value !== 'object') return false;
  const point = value as Partial<DiretorioMapPoint>;
  return Boolean(
    point.slug && point.nome && point.cidade && point.estado && point.perfilUrl &&
    typeof point.lat === 'number' && Number.isFinite(point.lat) &&
    typeof point.lng === 'number' && Number.isFinite(point.lng) &&
    !(Math.abs(point.lat) < 0.2 && Math.abs(point.lng) < 0.2) &&
    point.lat >= -34.5 && point.lat <= 5.5 &&
    point.lng >= -74.5 && point.lng <= -32.0
  );
}

function expandCompactMap(payload: DiretorioMapPayloadV2): DiretorioMapPoint[] {
  const slugs = payload.s || [];
  const nomes = payload.n || [];
  const cities = payload.cities || [];
  const ufs = payload.ufs || [];
  const cityIdx = payload.c || [];
  const ufIdx = payload.e || [];
  const lats = payload.a || [];
  const lngs = payload.o || [];
  const verified = payload.r || [];
  const instagram = payload.i || [];
  const points: DiretorioMapPoint[] = [];
  for (let i = 0; i < slugs.length; i += 1) {
    const candidate = {
      slug: slugs[i],
      nome: nomes[i],
      cidade: cities[cityIdx[i]] || '',
      estado: ufs[ufIdx[i]] || '',
      perfilUrl: `/terreiro/${encodeURIComponent(slugs[i])}`,
      lat: (lats[i] || 0) / 1e5,
      lng: (lngs[i] || 0) / 1e5,
      verificada: verified[i] === 1,
      instagramUrl: instagram[i] || null,
    };
    if (isMapPoint(candidate)) points.push(candidate);
  }
  return points;
}

export async function fetchDiretorioMapPoints(signal?: AbortSignal): Promise<DiretorioMapPoint[]> {
  let response = await fetch('/api/v1/public/diretorio/mapa', { signal, cache: 'no-store' });
  if (!response.ok) {
    response = await fetch('/terreiros/mapa.json', { signal });
  }
  if (!response.ok) throw new Error(`Mapa respondeu ${response.status}`);
  const payload = (await response.json()) as DiretorioMapPayloadV1 & DiretorioMapPayloadV2;
  if (payload.v === 2) {
    const points = expandCompactMap(payload);
    if (points.length === 0) throw new Error('Mapa sem coordenadas válidas');
    return points;
  }
  const points = Array.isArray(payload.points)
    ? payload.points.filter(isMapPoint).map((point) => ({ ...point, verificada: point.verificada === true, instagramUrl: point.instagramUrl || null }))
    : [];
  if (points.length === 0) throw new Error('Mapa sem coordenadas válidas');
  return points;
}
