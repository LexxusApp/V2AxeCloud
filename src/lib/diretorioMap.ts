export type DiretorioMapPoint = {
  slug: string;
  nome: string;
  cidade: string;
  estado: string;
  perfilUrl: string;
  lat: number;
  lng: number;
};

type DiretorioMapPayload = { points?: unknown[] };

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

export async function fetchDiretorioMapPoints(signal?: AbortSignal): Promise<DiretorioMapPoint[]> {
  const response = await fetch('/terreiros/mapa.json', { signal });
  if (!response.ok) throw new Error(`Mapa respondeu ${response.status}`);
  const payload = (await response.json()) as DiretorioMapPayload;
  const points = Array.isArray(payload.points) ? payload.points.filter(isMapPoint) : [];
  if (points.length === 0) throw new Error('Mapa sem coordenadas válidas');
  return points;
}
