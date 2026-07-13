import { LocateFixed, MapPinned, Navigation } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { DiretorioCidadeSnapshot } from '../../lib/diretorioSnapshot';
import { diretorioCityPath } from '../../lib/diretorioSlug';

type GeoPoint = {
  cidade: string;
  estado: string;
  cidadeSlug: string;
  lat: number;
  lng: number;
  total: number;
};

function parseGoogleMapsCoordinates(link: string | null): { lat: number; lng: number } | null {
  if (!link) return null;
  const at = link.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  const data = link.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  const match = at || data;
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function cityPoints(cidades: DiretorioCidadeSnapshot[]): GeoPoint[] {
  return cidades.flatMap((cidade) => {
    const coordinates = cidade.bairros
      .flatMap((bairro) => bairro.items)
      .map((item) => parseGoogleMapsCoordinates(item.linkMaps))
      .filter((point): point is { lat: number; lng: number } => Boolean(point));

    if (coordinates.length === 0) return [];
    return [{
      cidade: cidade.cidade,
      estado: cidade.estado || 'SP',
      cidadeSlug: cidade.cidadeSlug,
      lat: coordinates.reduce((sum, point) => sum + point.lat, 0) / coordinates.length,
      lng: coordinates.reduce((sum, point) => sum + point.lng, 0) / coordinates.length,
      total: cidade.totalTerreiros,
    }];
  });
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function DirectoryCoverageMap({ cidades }: { cidades: DiretorioCidadeSnapshot[] }) {
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const points = useMemo(() => cityPoints(cidades).sort((a, b) => b.total - a.total), [cidades]);

  const bounds = useMemo(() => {
    if (points.length === 0) return null;
    const lats = points.map((point) => point.lat);
    const lngs = points.map((point) => point.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      minLat,
      maxLat,
      minLng,
      maxLng,
      latSpan: Math.max(maxLat - minLat, 0.3),
      lngSpan: Math.max(maxLng - minLng, 0.3),
    };
  }, [points]);

  if (!bounds || points.length === 0) return null;

  const locateNearest = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Localização não disponível neste navegador.');
      return;
    }
    setLocationStatus('Buscando a cidade mais próxima…');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nearest = points.reduce((best, point) => (
          distanceKm({ lat: coords.latitude, lng: coords.longitude }, point) <
          distanceKm({ lat: coords.latitude, lng: coords.longitude }, best)
            ? point
            : best
        ));
        window.location.href = diretorioCityPath(nearest.estado, nearest.cidadeSlug);
      },
      () => setLocationStatus('Permita a localização para encontrar a cidade mais próxima.'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  };

  return (
    <section className="mt-12 overflow-hidden rounded-[2rem] border border-[#2e281f] bg-[#17130e] text-white shadow-2xl shadow-black/15" aria-labelledby="coverage-map-title">
      <div className="grid gap-6 border-b border-white/10 px-6 py-6 md:grid-cols-[1fr_auto] md:items-end md:px-8">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#ffc107]">
            <MapPinned className="h-4 w-4" aria-hidden />
            Visão geográfica
          </p>
          <h2 id="coverage-map-title" className="mt-2 text-2xl font-black md:text-3xl">
            Onde estão as casas mapeadas
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/58">
            Veja a distribuição aproximada das cidades e escolha uma região. O tamanho do ponto indica a quantidade de terreiros cadastrados.
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={locateNearest}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#ffc107] px-5 py-3 text-sm font-black text-[#1b1813] transition hover:bg-[#ffcd38] md:w-auto"
          >
            <LocateFixed className="h-4 w-4" aria-hidden />
            Encontrar perto de mim
          </button>
          {locationStatus ? <p className="mt-2 max-w-xs text-xs text-white/55" role="status">{locationStatus}</p> : null}
        </div>
      </div>

      <div className="relative overflow-hidden bg-[radial-gradient(circle_at_50%_45%,rgba(255,193,7,0.09),transparent_58%)] p-3 sm:p-6">
        <svg viewBox="0 0 1000 520" className="h-auto min-h-[310px] w-full" role="img" aria-label={`Mapa com ${points.length} cidades mapeadas`}>
          <defs>
            <pattern id="directory-map-grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(255,255,255,0.055)" strokeWidth="1" />
            </pattern>
            <filter id="directory-map-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="7" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <rect width="1000" height="520" rx="28" fill="url(#directory-map-grid)" />
          <path d="M90 330 C190 145 390 90 560 135 C700 172 795 105 920 205 C840 385 665 448 475 420 C300 395 190 455 90 330Z" fill="rgba(255,255,255,0.025)" stroke="rgba(255,193,7,0.16)" strokeWidth="2" />

          {points.map((point, index) => {
            const x = 70 + ((point.lng - bounds.minLng) / bounds.lngSpan) * 860;
            const y = 455 - ((point.lat - bounds.minLat) / bounds.latSpan) * 390;
            const radius = Math.min(22, 7 + Math.sqrt(Math.max(point.total, 1)) * 1.35);
            const showLabel = index < 12;
            return (
              <a key={`${point.estado}-${point.cidadeSlug}`} href={diretorioCityPath(point.estado, point.cidadeSlug)} aria-label={`${point.cidade}: ${point.total} terreiros`}>
                <g className="group cursor-pointer" transform={`translate(${x} ${y})`}>
                  <circle r={radius + 7} fill="rgba(255,193,7,0.08)" className="transition group-hover:fill-[rgba(255,193,7,0.2)]" />
                  <circle r={radius} fill="#ffc107" stroke="#fff4c7" strokeWidth="2" filter="url(#directory-map-glow)" />
                  <text y="4" textAnchor="middle" fontSize={Math.max(9, radius * 0.78)} fontWeight="900" fill="#1b1813">{point.total}</text>
                  {showLabel ? (
                    <text y={radius + 20} textAnchor="middle" fontSize="13" fontWeight="800" fill="rgba(255,255,255,0.82)" paintOrder="stroke" stroke="#17130e" strokeWidth="5">
                      {point.cidade}
                    </text>
                  ) : null}
                  <title>{point.cidade}, {point.estado} — {point.total} terreiros</title>
                </g>
              </a>
            );
          })}
        </svg>
        <p className="mt-1 flex items-center justify-center gap-2 text-center text-[11px] text-white/40">
          <Navigation className="h-3.5 w-3.5" aria-hidden />
          Posições aproximadas, calculadas a partir dos endereços públicos do diretório.
        </p>
      </div>
    </section>
  );
}
