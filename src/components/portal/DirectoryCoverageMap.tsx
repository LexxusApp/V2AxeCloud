import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, MapPinned, Navigation, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  const decoded = decodeURIComponent(link);
  const patterns = [
    /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /[?&](?:q|query|ll)=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,
  ];
  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (!match) continue;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  return null;
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

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char] || char);
}

export function DirectoryCoverageMap({
  cidades,
  loading = false,
}: {
  cidades: DiretorioCidadeSnapshot[];
  loading?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Array<{ point: GeoPoint; marker: L.CircleMarker }>>([]);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const points = useMemo(() => cityPoints(cidades).sort((a, b) => b.total - a.total), [cidades]);

  useEffect(() => {
    if (!containerRef.current || points.length === 0) return;
    if (mapRef.current) mapRef.current.remove();

    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      minZoom: 7,
    });
    mapRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    markersRef.current = points.map((point) => {
      const radius = Math.min(19, 7 + Math.sqrt(Math.max(point.total, 1)) * 0.75);
      const marker = L.circleMarker([point.lat, point.lng], {
        radius,
        color: '#5f4300',
        weight: 2,
        fillColor: '#ffc107',
        fillOpacity: 0.92,
      }).addTo(map);
      const href = diretorioCityPath(point.estado, point.cidadeSlug);
      marker.bindTooltip(`${point.cidade}: ${point.total} terreiros`, { direction: 'top' });
      marker.bindPopup(`
        <div style="min-width:190px;font-family:system-ui,sans-serif;color:#1b1813">
          <strong style="font-size:15px">${escapeHtml(point.cidade)}, ${escapeHtml(point.estado)}</strong>
          <p style="margin:6px 0 12px;color:#665f55">${point.total} terreiro${point.total === 1 ? '' : 's'} mapeado${point.total === 1 ? '' : 's'}</p>
          <a href="${href}" style="display:inline-block;border-radius:999px;background:#1b1813;color:#fff;padding:8px 12px;text-decoration:none;font-weight:700">Ver terreiros</a>
        </div>
      `);
      return { point, marker };
    });

    const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [34, 34], maxZoom: 11 });
    window.setTimeout(() => map.invalidateSize(), 80);

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
  }, [points]);

  const locateNearest = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Localização não disponível neste navegador.');
      return;
    }
    if (points.length === 0) {
      setLocationStatus('O mapa ainda está carregando.');
      return;
    }
    setLocationStatus('Localizando você…');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const origin = { lat: coords.latitude, lng: coords.longitude };
        const nearest = points.reduce((best, point) =>
          distanceKm(origin, point) < distanceKm(origin, best) ? point : best,
        );
        const item = markersRef.current.find(({ point }) => point.cidadeSlug === nearest.cidadeSlug);
        mapRef.current?.flyTo([nearest.lat, nearest.lng], 12, { duration: 1.1 });
        item?.marker.openPopup();
        setLocationStatus(`${nearest.cidade} é a região mapeada mais próxima.`);
      },
      () => setLocationStatus('Permita a localização no navegador para usar “perto de mim”.'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  };

  return (
    <section className="mt-10 overflow-hidden rounded-[2rem] border border-[#ded4c5] bg-white shadow-2xl shadow-black/10" aria-labelledby="coverage-map-title">
      <div className="grid gap-5 border-b border-[#e8dfd0] bg-[#17130e] px-6 py-6 text-white md:grid-cols-[1fr_auto] md:items-end md:px-8">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#ffc107]">
            <MapPinned className="h-4 w-4" aria-hidden />
            Mapa interativo
          </p>
          <h2 id="coverage-map-title" className="mt-2 text-2xl font-black md:text-3xl">Terreiros no mapa</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/65">
            Navegue pelo mapa, aproxime uma região ou use sua localização para encontrar as cidades mais próximas.
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
          {locationStatus ? <p className="mt-2 max-w-xs text-xs text-white/65" role="status">{locationStatus}</p> : null}
        </div>
      </div>

      <div className="relative min-h-[390px] bg-[#eee9df] md:min-h-[520px]">
        <div ref={containerRef} className="absolute inset-0 z-0" aria-label={`Mapa interativo com ${points.length} cidades`} />
        {points.length === 0 ? (
          <div className="absolute inset-0 z-10 grid place-items-center bg-[#f4efe7] px-6 text-center">
            <div>
              <RotateCcw className={`mx-auto h-7 w-7 text-[#a87400] ${loading ? 'animate-spin' : ''}`} aria-hidden />
              <p className="mt-3 font-bold text-[#1b1813]">
                {loading ? 'Carregando o mapa dos terreiros…' : 'Não foi possível carregar os pontos do mapa.'}
              </p>
              {!loading ? <p className="mt-1 text-sm text-[#1b1813]/60">A lista por cidades continua disponível logo abaixo.</p> : null}
            </div>
          </div>
        ) : null}
      </div>
      <p className="flex items-center justify-center gap-2 border-t border-[#e8dfd0] px-4 py-3 text-center text-[11px] text-[#1b1813]/50">
        <Navigation className="h-3.5 w-3.5" aria-hidden />
        {points.length} cidades no mapa · posições aproximadas a partir dos endereços públicos do diretório.
      </p>
    </section>
  );
}
