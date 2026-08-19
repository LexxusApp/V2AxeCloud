import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BadgeCheck, LocateFixed, MapPin, Navigation, RotateCcw } from 'lucide-react';
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
  const verifiedBadge = point.verificada
    ? `<span style="display:inline-flex;align-items:center;gap:4px;background:#dcfce7;color:#166534;border:1px solid #bbf7d0;border-radius:999px;padding:3px 8px;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
        Verificado
      </span>`
    : '';
  const igLink = point.instagramUrl
    ? `<a href="${escapeHtml(point.instagramUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:5px;color:#a21caf;text-decoration:none;font-size:12px;font-weight:700">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
        Instagram
      </a>`
    : '';

  return `
    <div style="min-width:220px;max-width:280px;font-family:system-ui,-apple-system,sans-serif;color:#1b1813;padding:2px">
      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
          <strong style="font-size:15px;line-height:1.3;font-weight:800">${escapeHtml(point.nome)}</strong>
          ${verifiedBadge}
        </div>
        <p style="margin:0;color:#665f55;font-size:12px;font-weight:600;display:flex;align-items:center;gap:4px">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a87400" stroke-width="2.5"><path d="M21 10c0 6-9 13-9 13S3 16 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${escapeHtml(point.cidade)}, ${escapeHtml(point.estado)}
        </p>
        ${igLink ? `<div style="margin-top:2px">${igLink}</div>` : ''}
      </div>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        <a href="${escapeHtml(point.perfilUrl)}" style="display:inline-flex;align-items:center;gap:6px;border-radius:999px;background:#172018;color:#fff;padding:8px 14px;text-decoration:none;font-weight:800;font-size:12px">
          Ver perfil completo →
        </a>
      </div>
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
    map.on('moveend zoomend resize viewreset', this._redraw, this);
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
    drawPoints(false, 'rgba(229, 174, 18, 0.92)', '#6B4E00');
    drawPoints(true, 'rgba(52, 211, 153, 0.97)', '#065F46', 1.4);
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
  const [searchQuery, setSearchQuery] = useState('');

  pointsRef.current = points;

  const filteredPoints = searchQuery.trim()
    ? points.filter((p) => {
        const q = searchQuery.toLowerCase();
        return (
          p.nome.toLowerCase().includes(q) ||
          p.cidade.toLowerCase().includes(q) ||
          p.estado.toLowerCase().includes(q)
        );
      })
    : points;

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) mapRef.current.remove();

    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      minZoom: 4,
      maxZoom: 18,
      preferCanvas: true,
      zoomAnimation: true,
    });
    mapRef.current = map;

    // CartoDB Positron — clean, modern light basemap (no API key needed)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
    }).addTo(map);

    const layer = new CanvasPointsLayer().addTo(map) as InstanceType<typeof CanvasPointsLayer>;
    layerRef.current = layer;

    const openPoint = (point: DiretorioMapPoint) => {
      L.popup({ maxWidth: 300, className: 'axecloud-popup' })
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
    layer.setPoints(filteredPoints);
    if (filteredPoints.length === 0) return;
    if (!searchQuery.trim()) {
      map.fitBounds(L.latLngBounds(filteredPoints.map((p) => [p.lat, p.lng] as [number, number])), {
        padding: [34, 34],
        maxZoom: 11,
      });
    }
    window.setTimeout(() => map.invalidateSize(), 80);
  }, [filteredPoints, searchQuery]);

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

  const verifiedCount = points.filter((p) => p.verificada).length;

  return (
    <section
      className="mt-10 overflow-hidden rounded-[2rem] border border-[#e0d6c8] bg-white shadow-[0_32px_90px_rgba(0,0,0,.12)]"
      aria-labelledby="coverage-map-title"
    >
      {/* Header */}
      <div className="border-b border-[#e8dfd0] bg-[#111810] px-6 py-6 text-white md:px-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#E5AE12]">
              Diretório AxéCloud
            </p>
            <h2 id="coverage-map-title" className="mt-1 text-2xl font-black md:text-3xl">
              Terreiros no mapa
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/60">
              Explore as casas com coordenadas confirmadas. Clique em qualquer pin para ver o perfil.
            </p>

            {/* Legenda */}
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-bold text-white/70" aria-label="Legenda do mapa">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full border border-[#6B4E00] bg-[#E5AE12]" />
                Terreiro no diretório
              </span>
              <span className="inline-flex items-center gap-2">
                <BadgeCheck className="h-3 w-3 text-emerald-400" />
                <span className="h-3 w-3 rounded-full border border-[#065F46] bg-[#34D399]" />
                Perfil reivindicado ({verifiedCount.toLocaleString('pt-BR')})
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:items-end">
            {/* Busca rápida */}
            <div className="relative w-full md:w-64">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#E5AE12]" aria-hidden />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar por nome ou cidade…"
                className="h-10 w-full rounded-full border border-white/15 bg-white/10 pl-9 pr-4 text-sm font-semibold text-white placeholder:text-white/35 outline-none transition focus:border-[#E5AE12]/50 focus:ring-2 focus:ring-[#E5AE12]/15"
              />
            </div>

            <button
              type="button"
              onClick={locateNearest}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#E5AE12] px-5 py-2.5 text-sm font-black text-[#1b1813] transition hover:bg-[#F4C43A] md:w-auto"
            >
              <LocateFixed className="h-4 w-4" aria-hidden />
              Encontrar perto de mim
            </button>
            {locationStatus ? (
              <p className="max-w-xs text-[11px] text-white/60" role="status">{locationStatus}</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Map area */}
      <div className="relative min-h-[460px] bg-[#f0ece3] md:min-h-[680px]">
        <div
          ref={containerRef}
          className="absolute inset-0 z-0"
          aria-label={`Mapa interativo com ${filteredPoints.length} terreiros`}
        />

        {/* Loading skeleton */}
        {loading && points.length === 0 ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#f0ece3]/90 px-6 text-center">
            <div className="relative h-14 w-14">
              <RotateCcw className="h-14 w-14 animate-spin text-[#E5AE12]/30" aria-hidden />
              <MapPin className="absolute inset-0 m-auto h-6 w-6 text-[#E5AE12]" aria-hidden />
            </div>
            <div>
              <p className="font-black text-[#1b1813]">Carregando o mapa dos terreiros…</p>
              <p className="mt-1 text-sm text-[#1b1813]/50">Preparando {points.length > 0 ? points.length.toLocaleString('pt-BR') : 'os'} pontos</p>
            </div>
            {/* Skeleton bars */}
            <div className="mt-4 flex flex-col gap-2 w-48 opacity-50">
              <div className="h-2.5 rounded-full bg-[#c4b99e] animate-pulse" />
              <div className="h-2.5 rounded-full bg-[#c4b99e] animate-pulse w-3/4 self-center" />
              <div className="h-2.5 rounded-full bg-[#c4b99e] animate-pulse w-1/2 self-center" />
            </div>
          </div>
        ) : !loading && points.length === 0 ? (
          <div className="absolute inset-0 z-10 grid place-items-center bg-[#f4efe7] px-6 text-center">
            <div>
              <RotateCcw className="mx-auto h-7 w-7 text-[#a87400]" aria-hidden />
              <p className="mt-3 font-bold text-[#1b1813]">Não foi possível carregar os pontos do mapa.</p>
              <p className="mt-1 text-sm text-[#1b1813]/60">A lista por cidades continua disponível.</p>
              {onRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-4 rounded-full bg-[#1b1813] px-5 py-2.5 text-sm font-black text-white"
                >
                  Tentar novamente
                </button>
              ) : null}
            </div>
          </div>
        ) : searchQuery.trim() && filteredPoints.length === 0 ? (
          <div className="absolute inset-0 z-10 grid place-items-center bg-[#f4efe7]/80 px-6 text-center">
            <div>
              <MapPin className="mx-auto h-7 w-7 text-[#a87400]" aria-hidden />
              <p className="mt-3 font-bold text-[#1b1813]">Nenhum terreiro encontrado para "{searchQuery}".</p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-4 rounded-full border border-[#1b1813]/20 bg-white px-5 py-2 text-sm font-bold text-[#1b1813]"
              >
                Limpar filtro
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e8dfd0] px-6 py-3.5 text-[11px] text-[#1b1813]/50 md:px-8">
        <span className="flex items-center gap-1.5">
          <Navigation className="h-3.5 w-3.5" aria-hidden />
          {searchQuery.trim()
            ? `${filteredPoints.length.toLocaleString('pt-BR')} de ${points.length.toLocaleString('pt-BR')} terreiros filtrados`
            : `${points.length.toLocaleString('pt-BR')} terreiros com localização exata`}
        </span>
        <span>Coordenadas obtidas dos links públicos do Google Maps</span>
      </div>
    </section>
  );
}
