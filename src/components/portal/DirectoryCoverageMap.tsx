import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, MapPin, RotateCcw, Search } from 'lucide-react';
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
  const situation = point.verificada ? 'Perfil verificado' : 'Casa mapeada';
  const igLink = point.instagramUrl
    ? `<a class="axe-map-profile__social" href="${escapeHtml(point.instagramUrl)}" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
        Ver Instagram
      </a>`
    : '';

  return `
    <article class="axe-map-profile">
      <header class="axe-map-profile__head">
        <span class="axe-map-profile__mark"><img src="/favicon.svg?v=tridente-2026" alt="" /></span>
        <div><p class="axe-map-profile__eyebrow">Diretório AxéCloud</p><p class="axe-map-profile__state">${situation}</p></div>
      </header>
      <div class="axe-map-profile__body">
        <h2 class="axe-map-profile__name">${escapeHtml(point.nome)}</h2>
        <p class="axe-map-profile__location"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>${escapeHtml(point.cidade)} · ${escapeHtml(point.estado)}</p>
        ${igLink}
        <div class="axe-map-profile__actions">
          <a class="axe-map-profile__action axe-map-profile__action--primary" href="${escapeHtml(point.perfilUrl)}">Conhecer esta casa <span>→</span></a>
        </div>
      </div>
    </article>
  `;
}

type RenderedMapItem =
  | { kind: 'point'; point: DiretorioMapPoint; x: number; y: number; radius: number }
  | {
      kind: 'cluster';
      lat: number;
      lng: number;
      count: number;
      verifiedCount: number;
      x: number;
      y: number;
      radius: number;
    };

/**
 * Camada canvas com agrupamento progressivo. No enquadramento regional o mapa
 * comunica densidade sem transformar milhares de coordenadas em ruído visual;
 * os pontos individuais aparecem conforme o usuário se aproxima.
 */
const CanvasPointsLayer = L.Layer.extend({
  initialize(this: L.Layer & { _points: DiretorioMapPoint[]; _renderedItems: RenderedMapItem[] }) {
    this._points = [];
    this._renderedItems = [];
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
  hitTest(this: L.Layer & { _map: L.Map; _renderedItems: RenderedMapItem[] }, latlng: L.LatLng, maxPx = 12) {
    if (!this._map || !this._renderedItems.length) return null;
    const origin = this._map.latLngToContainerPoint(latlng);
    let best: RenderedMapItem | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const item of this._renderedItems) {
      const dx = item.x - origin.x;
      const dy = item.y - origin.y;
      const d = dx * dx + dy * dy;
      const hitRadius = Math.max(maxPx, item.radius + 5);
      if (d <= hitRadius * hitRadius && d < bestD) {
        bestD = d;
        best = item;
      }
    }
    return best;
  },
  _redraw(this: L.Layer & {
    _map: L.Map;
    _canvas: HTMLCanvasElement;
    _points: DiretorioMapPoint[];
    _renderedItems: RenderedMapItem[];
  }) {
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
    this._renderedItems = [];
    if (!this._points.length) return;
    const bounds = map.getBounds().pad(0.08);
    const zoom = map.getZoom();

    const visible = this._points.filter((point) => bounds.contains([point.lat, point.lng]));
    const renderPoint = (point: DiretorioMapPoint) => {
      const pt = map.latLngToContainerPoint([point.lat, point.lng]);
      const radius = point.verificada ? 7 : zoom >= 13 ? 5.5 : 4.5;
      ctx.save();
      ctx.shadowColor = point.verificada ? 'rgba(16, 185, 129, .42)' : 'rgba(91, 62, 0, .24)';
      ctx.shadowBlur = point.verificada ? 12 : 5;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = point.verificada ? '#16865f' : '#e5ae12';
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = point.verificada ? 2.5 : 1.5;
      ctx.strokeStyle = point.verificada ? '#ffffff' : '#fff8e2';
      ctx.stroke();
      if (point.verificada) {
        ctx.beginPath();
        ctx.moveTo(pt.x - 2.4, pt.y);
        ctx.lineTo(pt.x - 0.4, pt.y + 2.2);
        ctx.lineTo(pt.x + 3.2, pt.y - 2.6);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
      ctx.restore();
      this._renderedItems.push({ kind: 'point', point, x: pt.x, y: pt.y, radius });
    };

    if (zoom >= 12) {
      visible.forEach(renderPoint);
      return;
    }

    const cellSize = zoom <= 5 ? 112 : zoom <= 7 ? 100 : zoom <= 9 ? 68 : 52;
    const groups = new Map<string, DiretorioMapPoint[]>();
    for (const point of visible) {
      const pt = map.latLngToContainerPoint([point.lat, point.lng]);
      const key = `${Math.floor(pt.x / cellSize)}:${Math.floor(pt.y / cellSize)}`;
      const group = groups.get(key);
      if (group) group.push(point);
      else groups.set(key, [point]);
    }

    for (const group of groups.values()) {
      if (group.length === 1) {
        renderPoint(group[0]);
        continue;
      }
      const lat = group.reduce((sum, point) => sum + point.lat, 0) / group.length;
      const lng = group.reduce((sum, point) => sum + point.lng, 0) / group.length;
      const verifiedCount = group.reduce((sum, point) => sum + (point.verificada ? 1 : 0), 0);
      const pt = map.latLngToContainerPoint([lat, lng]);
      const radius = Math.min(29, 14 + Math.log2(group.length) * 2.2);

      ctx.save();
      ctx.shadowColor = 'rgba(10, 42, 30, .30)';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#153d2d';
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#f1b90b';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, Math.max(4, radius - 6), 0, Math.PI * 2);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, .15)';
      ctx.stroke();

      const label = group.length > 999 ? `${(group.length / 1000).toFixed(1).replace('.', ',')}k` : String(group.length);
      ctx.fillStyle = '#fffaf0';
      ctx.font = `800 ${label.length > 3 ? 11 : 12}px Manrope, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, pt.x, pt.y + 0.5);

      if (verifiedCount > 0) {
        ctx.beginPath();
        ctx.arc(pt.x + radius * 0.72, pt.y - radius * 0.72, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#34d399';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
      ctx.restore();
      this._renderedItems.push({ kind: 'cluster', lat, lng, count: group.length, verifiedCount, x: pt.x, y: pt.y, radius });
    }
  },
}) as new () => L.Layer & {
  setPoints: (points: DiretorioMapPoint[]) => void;
  hitTest: (latlng: L.LatLng, maxPx?: number) => RenderedMapItem | null;
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
      zoomControl: false,
      scrollWheelZoom: false,
      minZoom: 4,
      maxZoom: 18,
      preferCanvas: true,
      zoomAnimation: true,
    });
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    mapRef.current = map;

    // Cartografia clara e silenciosa, ajustada à paleta editorial do AxéCloud.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      className: 'axecloud-directory-tiles',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
    }).addTo(map);

    const layer = new CanvasPointsLayer().addTo(map) as InstanceType<typeof CanvasPointsLayer>;
    layerRef.current = layer;

    const openPoint = (point: DiretorioMapPoint) => {
      L.popup({
        maxWidth: 360,
        minWidth: 300,
        className: 'axecloud-map-popup',
        autoPanPaddingTopLeft: [32, 132],
        autoPanPaddingBottomRight: [32, 48],
      })
        .setLatLng([point.lat, point.lng])
        .setContent(popupHtml(point))
        .openOn(map);
    };

    map.on('mousemove', (event: L.LeafletMouseEvent) => {
      const hit = layer.hitTest(event.latlng);
      map.getContainer().style.cursor = hit ? 'pointer' : '';
    });

    map.on('mouseout', () => {
      map.getContainer().style.cursor = '';
    });

    map.on('click', (event: L.LeafletMouseEvent) => {
      const hit = layer.hitTest(event.latlng);
      if (!hit) return;
      if (hit.kind === 'cluster') {
        map.flyTo([hit.lat, hit.lng], Math.min(12, map.getZoom() + (map.getZoom() < 8 ? 2 : 1)), {
          duration: 0.65,
        });
        return;
      }
      openPoint(hit.point);
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
        L.popup({
          maxWidth: 360,
          minWidth: 300,
          className: 'axecloud-map-popup',
          autoPanPaddingTopLeft: [32, 132],
          autoPanPaddingBottomRight: [32, 48],
        })
          .setLatLng([nearest.lat, nearest.lng])
          .setContent(popupHtml(nearest))
          .openOn(mapRef.current!);
        setLocationStatus(`${nearest.nome}, em ${nearest.cidade}, é a casa mapeada mais próxima.`);
        window.setTimeout(() => setLocationStatus(null), 3600);
      },
      () => setLocationStatus('Permita a localização no navegador para usar “perto de mim”.'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  };

  const verifiedCount = points.filter((p) => p.verificada).length;

  return (
    <section
      className="relative mt-7 overflow-hidden rounded-[1.5rem] border border-[#d8cdbd] bg-[#f0ece3] shadow-[0_28px_80px_rgba(0,0,0,.14)] md:rounded-[2rem]"
      aria-labelledby="coverage-map-title"
    >
      <h2 id="coverage-map-title" className="sr-only">Terreiros no mapa</h2>

      {/* Map area */}
      <div className="relative min-h-[68svh] bg-[#eae4d8] md:min-h-[72vh] md:max-h-[860px]">
        <div
          ref={containerRef}
          className="absolute inset-0 z-0"
          aria-label={`Mapa interativo com ${filteredPoints.length} terreiros`}
        />

        <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex flex-col items-start gap-2 md:inset-x-5 md:top-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="pointer-events-auto flex w-full max-w-2xl items-center gap-2 rounded-2xl border border-[#ead8a2]/30 bg-[#10271e]/94 p-2 shadow-[0_18px_48px_rgba(12,37,27,.24)] backdrop-blur-xl">
            <Search className="ml-2 h-4 w-4 shrink-0 text-[#E5AE12]" aria-hidden />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por terreiro ou cidade…"
              className="h-10 min-w-0 flex-1 bg-transparent px-1 text-sm font-semibold text-white outline-none placeholder:text-white/45"
            />
            <button
              type="button"
              onClick={locateNearest}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#E5AE12] px-3 text-xs font-black text-[#1b1813] transition hover:bg-[#F4C43A] md:px-4 md:text-sm"
            >
              <LocateFixed className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Perto de mim</span>
            </button>
          </div>

          <div className="pointer-events-auto self-start rounded-xl border border-white/80 bg-[#fffaf0]/94 px-3 py-2 text-[10px] font-bold text-[#1b1813]/70 shadow-lg backdrop-blur-xl" aria-label="Legenda do mapa">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-[#E5AE12] bg-[#153d2d]" /> Agrupamentos
            </span>
            <span className="ml-3 inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border border-white bg-[#16865f] shadow-sm" /> {verifiedCount.toLocaleString('pt-BR')} verificadas
            </span>
          </div>
        </div>

        {locationStatus ? (
          <p className="absolute bottom-14 left-1/2 z-[500] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-full bg-[#111810]/90 px-4 py-2 text-center text-[11px] font-semibold text-white shadow-xl backdrop-blur" role="status">
            {locationStatus}
          </p>
        ) : null}

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

        {!loading && points.length > 0 ? (
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-[500] -translate-x-1/2 whitespace-nowrap rounded-full border border-white/70 bg-white/92 px-4 py-2 text-[11px] font-bold text-[#1b1813]/65 shadow-lg backdrop-blur-xl">
            {searchQuery.trim()
              ? `${filteredPoints.length.toLocaleString('pt-BR')} de ${points.length.toLocaleString('pt-BR')} casas`
              : `${points.length.toLocaleString('pt-BR')} casas com localização confirmada`}
          </div>
        ) : null}
      </div>
    </section>
  );
}
