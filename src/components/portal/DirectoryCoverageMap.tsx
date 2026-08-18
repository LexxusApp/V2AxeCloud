import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, Navigation, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { DiretorioMapPoint } from '../../lib/diretorioMap';

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

function popupHtml(point: DiretorioMapPoint) {
  return `
    <div style="min-width:190px;font-family:system-ui,sans-serif;color:#1b1813">
      <strong style="font-size:15px">${escapeHtml(point.nome)}</strong>
      ${point.verificada ? '<p style="margin:6px 0 0;color:#1d4ed8;font-size:11px;font-weight:800">✓ Terreiro verificado e reivindicado</p>' : ''}
      <p style="margin:6px 0 12px;color:#665f55">${escapeHtml(point.cidade)}, ${escapeHtml(point.estado)}</p>
      ${point.instagramUrl ? `<a href="${escapeHtml(point.instagramUrl)}" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;gap:6px;margin:0 0 10px;color:#c026d3;text-decoration:none;font-size:12px;font-weight:800"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>Instagram</a>` : ''}
      <a href="${escapeHtml(point.perfilUrl)}" style="display:inline-block;border-radius:999px;background:#1b1813;color:#fff;padding:8px 12px;text-decoration:none;font-weight:700">Ver perfil</a>
    </div>
  `;
}

/** Uma camada canvas: milhares de pins sem criar CircleMarker por ponto. */
const CanvasPointsLayer = L.Layer.extend({
  initialize(this: L.Layer & { _points: DiretorioMapPoint[] }) {
    this._points = [];
  },
  onAdd(this: L.Layer & {
    _map: L.Map;
    _canvas: HTMLCanvasElement;
    _points: DiretorioMapPoint[];
    _redraw: () => void;
  }, map: L.Map) {
    this._map = map;
    this._canvas = L.DomUtil.create('canvas', 'leaflet-zoom-animated') as HTMLCanvasElement;
    this._canvas.style.pointerEvents = 'none';
    map.getPanes().overlayPane.appendChild(this._canvas);
    map.on('moveend zoomend resize viewreset zoomanim', this._redraw, this);
    this._redraw();
  },
  onRemove(this: L.Layer & {
    _map: L.Map;
    _canvas: HTMLCanvasElement;
    _redraw: () => void;
  }, map: L.Map) {
    map.off('moveend zoomend resize viewreset zoomanim', this._redraw, this);
    L.DomUtil.remove(this._canvas);
  },
  setPoints(this: L.Layer & { _points: DiretorioMapPoint[]; _redraw: () => void }, points: DiretorioMapPoint[]) {
    this._points = points;
    this._redraw();
  },
  hitTest(this: L.Layer & { _map: L.Map; _points: DiretorioMapPoint[] }, latlng: L.LatLng, maxPx = 16) {
    if (!this._map || !this._points.length) return null;
    const origin = this._map.latLngToContainerPoint(latlng);
    let best: DiretorioMapPoint | null = null;
    let bestD = maxPx * maxPx;
    for (const point of this._points) {
      const pt = this._map.latLngToContainerPoint([point.lat, point.lng]);
      const dx = pt.x - origin.x;
      const dy = pt.y - origin.y;
      const d = dx * dx + dy * dy;
      if (d <= bestD) {
        bestD = d;
        best = point;
      }
    }
    return best;
  },
  _redraw(this: L.Layer & { _map: L.Map; _canvas: HTMLCanvasElement; _points: DiretorioMapPoint[] }) {
    const map = this._map;
    if (!map || !this._canvas) return;
    const size = map.getSize();
    const topLeft = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(this._canvas, topLeft);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this._canvas.width = Math.round(size.x * dpr);
    this._canvas.height = Math.round(size.y * dpr);
    this._canvas.style.width = `${size.x}px`;
    this._canvas.style.height = `${size.y}px`;
    const ctx = this._canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.x, size.y);
    if (!this._points.length) return;
    const bounds = map.getBounds().pad(0.08);
    const zoom = map.getZoom();
    const radius = zoom >= 13 ? 6 : zoom >= 10 ? 5 : zoom >= 8 ? 4 : 3;
    ctx.lineWidth = zoom >= 10 ? 1.4 : 1;
    const drawPoints = (verified: boolean, fill: string, stroke: string, radiusScale = 1) => {
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.beginPath();
      for (const point of this._points) {
        if (point.verificada !== verified || !bounds.contains([point.lat, point.lng])) continue;
        const pt = map.latLngToContainerPoint([point.lat, point.lng]);
        const pointRadius = radius * radiusScale;
        ctx.moveTo(pt.x + pointRadius, pt.y);
        ctx.arc(pt.x, pt.y, pointRadius, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.stroke();
    };
    drawPoints(false, 'rgba(255, 193, 7, 0.9)', '#5f4300');
    drawPoints(true, 'rgba(37, 99, 235, 0.96)', '#0b3478', 1.35);
  },
}) as new () => L.Layer & {
  setPoints: (points: DiretorioMapPoint[]) => void;
  hitTest: (latlng: L.LatLng, maxPx?: number) => DiretorioMapPoint | null;
  _redraw: () => void;
};

export function DirectoryCoverageMap({
  points,
  loading = false,
  onRetry,
}: {
  points: DiretorioMapPoint[];
  loading?: boolean;
  onRetry?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<InstanceType<typeof CanvasPointsLayer> | null>(null);
  const pointsRef = useRef(points);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);

  pointsRef.current = points;

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) mapRef.current.remove();

    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      minZoom: 6,
      preferCanvas: true,
      zoomAnimation: false,
    });
    mapRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    const layer = new CanvasPointsLayer().addTo(map) as InstanceType<typeof CanvasPointsLayer>;
    layerRef.current = layer;

    const openPoint = (point: DiretorioMapPoint) => {
      L.popup({ maxWidth: 280 })
        .setLatLng([point.lat, point.lng])
        .setContent(popupHtml(point))
        .openOn(map);
    };

    map.on('click', (event: L.LeafletMouseEvent) => {
      const hit = layer.hitTest(event.latlng);
      if (hit) openPoint(hit);
    });

    window.setTimeout(() => map.invalidateSize(), 80);

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.setPoints(points);
    if (points.length === 0) return;
    map.fitBounds(L.latLngBounds(points.map((point) => [point.lat, point.lng] as [number, number])), {
      padding: [34, 34],
      maxZoom: 11,
    });
    window.setTimeout(() => map.invalidateSize(), 80);
  }, [points]);

  const locateNearest = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Localização não disponível neste navegador.');
      return;
    }
    if (pointsRef.current.length === 0) {
      setLocationStatus('O mapa ainda está carregando.');
      return;
    }
    setLocationStatus('Localizando você…');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const origin = { lat: coords.latitude, lng: coords.longitude };
        const nearest = pointsRef.current.reduce((best, point) =>
          distanceKm(origin, point) < distanceKm(origin, best) ? point : best,
        );
        mapRef.current?.flyTo([nearest.lat, nearest.lng], 15, { duration: 1.1 });
        L.popup({ maxWidth: 280 })
          .setLatLng([nearest.lat, nearest.lng])
          .setContent(popupHtml(nearest))
          .openOn(mapRef.current!);
        setLocationStatus(`${nearest.nome}, em ${nearest.cidade}, é a casa mapeada mais próxima.`);
      },
      () => setLocationStatus('Permita a localização no navegador para usar “perto de mim”.'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  };

  return (
    <section className="mt-10 overflow-hidden rounded-[2rem] border border-[#ded4c5] bg-white shadow-2xl shadow-black/10" aria-labelledby="coverage-map-title">
      <div className="grid gap-5 border-b border-[#e8dfd0] bg-[#17130e] px-6 py-5 text-white md:grid-cols-[1fr_auto] md:items-end md:px-8">
        <div>
          <h2 id="coverage-map-title" className="text-2xl font-black md:text-3xl">Terreiros no mapa</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/65">
            Explore as casas com coordenadas confirmadas, aproxime uma região ou use sua localização para encontrar o terreiro mais próximo.
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-bold text-white/75" aria-label="Legenda do mapa">
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full border border-[#5f4300] bg-[#ffc107]" />Cadastro do diretório</span>
            <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-blue-900 bg-blue-600" />Perfil reivindicado</span>
          </div>
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

      <div className="relative min-h-[440px] bg-[#eee9df] md:min-h-[640px]">
        <div ref={containerRef} className="absolute inset-0 z-0" aria-label={`Mapa interativo com ${points.length} terreiros`} />
        {points.length === 0 ? (
          <div className="absolute inset-0 z-10 grid place-items-center bg-[#f4efe7] px-6 text-center">
            <div>
              <RotateCcw className={`mx-auto h-7 w-7 text-[#a87400] ${loading ? 'animate-spin' : ''}`} aria-hidden />
              <p className="mt-3 font-bold text-[#1b1813]">
                {loading ? 'Carregando o mapa dos terreiros…' : 'Não foi possível carregar os pontos do mapa.'}
              </p>
              {!loading ? (
                <>
                  <p className="mt-1 text-sm text-[#1b1813]/60">A lista por cidades continua disponível.</p>
                  {onRetry ? (
                    <button type="button" onClick={onRetry} className="mt-4 rounded-full bg-[#1b1813] px-5 py-2.5 text-sm font-black text-white">
                      Tentar novamente
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      <p className="flex items-center justify-center gap-2 border-t border-[#e8dfd0] px-4 py-3 text-center text-[11px] text-[#1b1813]/50">
        <Navigation className="h-3.5 w-3.5" aria-hidden />
        {points.length} terreiros com localização exata · coordenadas obtidas dos links públicos do Google Maps.
      </p>
    </section>
  );
}
