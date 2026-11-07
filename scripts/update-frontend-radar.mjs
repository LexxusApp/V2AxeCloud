import fs from 'node:fs';

// 1. Update Dashboard.tsx
const dashPath = 'c:/Users/Lucas A/Desktop/AxecloudV2/AxecloudV2/src/views/Dashboard.tsx';
let dash = fs.readFileSync(dashPath, 'utf8');

const oldDashTarget = `                  <div className="dashboard-v5-radar-card__primary">
                    <Eye aria-hidden />
                    <strong>{radarMetrics?.views7 || 0}</strong>
                    <span>visualizações nos últimos 7 dias</span>
                  </div>`;

const newDashTarget = `                  <div className="dashboard-v5-radar-card__primary">
                    <Eye aria-hidden />
                    <strong>{(radarMetrics?.views7 || 0) > 0 ? radarMetrics?.views7 : (radarMetrics?.views30 || 0) > 0 ? radarMetrics?.views30 : (radarMetrics?.viewsTotal || 0) > 0 ? radarMetrics?.viewsTotal : 0}</strong>
                    <span>
                      {(radarMetrics?.views7 || 0) > 0
                        ? 'visualizações nos últimos 7 dias'
                        : (radarMetrics?.views30 || 0) > 0
                        ? 'visualizações nos últimos 30 dias'
                        : (radarMetrics?.viewsTotal || 0) > 0
                        ? 'visitas acumuladas no Radar'
                        : 'visualizações nos últimos 7 dias'}
                    </span>
                  </div>`;

const normDash = dash.replace(/\r\n/g, '\n');
const normOldDashTarget = oldDashTarget.replace(/\r\n/g, '\n');

if (normDash.includes(normOldDashTarget)) {
  dash = normDash.replace(normOldDashTarget, newDashTarget);
  fs.writeFileSync(dashPath, dash, 'utf8');
  console.log('Successfully updated Dashboard.tsx');
} else {
  console.error('Target not found in Dashboard.tsx');
}

// 2. Update Radar.tsx
const radarPath = 'c:/Users/Lucas A/Desktop/AxecloudV2/AxecloudV2/src/views/Radar.tsx';
let radar = fs.readFileSync(radarPath, 'utf8');

const oldRadarImports = `import { Eye, MapPinned, Radio, Sparkles, TrendingUp } from 'lucide-react';`;
const newRadarImports = `import { Eye, MapPinned, Radio, Sparkles, TrendingUp, Search, MessageCircle } from 'lucide-react';`;

const oldRadarType = `type RadarSummary = {
  profile?: {
    nome?: string;
    cidade?: string;
    estado?: string;
    publicacaoStatus?: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  metrics?: { viewsTotal?: number; views30?: number; views7?: number };
};`;

const newRadarType = `type RadarSummary = {
  profile?: {
    nome?: string;
    cidade?: string;
    estado?: string;
    publicacaoStatus?: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  metrics?: {
    viewsTotal?: number;
    views30?: number;
    views7?: number;
    directoryClicks30?: number;
    googleViews30?: number;
    whatsappClicks30?: number;
  };
};`;

const oldRadarMetricsBlock = `            <div className="grid grid-cols-3 gap-2.5">
              <Metric icon={Eye} label="7 dias" value={metrics?.views7 || 0} detail="Aberturas recentes" />
              <Metric icon={TrendingUp} label="30 dias" value={metrics?.views30 || 0} detail="Interesse no período" />
              <Metric icon={MapPinned} label="Total" value={metrics?.viewsTotal || 0} detail="Visitas ao perfil" />
            </div>`;

const newRadarMetricsBlock = `            <div>
              <div className="grid grid-cols-3 gap-2.5">
                <Metric icon={Eye} label="7 dias" value={metrics?.views7 || 0} detail="Aberturas recentes" />
                <Metric icon={TrendingUp} label="30 dias" value={metrics?.views30 || 0} detail="Interesse no período" />
                <Metric icon={MapPinned} label="Total" value={metrics?.viewsTotal || 0} detail="Visitas ao perfil" />
              </div>
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[11px] text-white/80">
                <span className="flex items-center gap-1"><MapPinned className="h-3 w-3 text-[#F2C441]" /> <strong>{metrics?.directoryClicks30 || 0}</strong> Mapa</span>
                <span className="text-white/20">•</span>
                <span className="flex items-center gap-1"><Search className="h-3 w-3 text-sky-400" /> <strong>{metrics?.googleViews30 || 0}</strong> Google</span>
                <span className="text-white/20">•</span>
                <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3 text-emerald-400" /> <strong>{metrics?.whatsappClicks30 || 0}</strong> WhatsApp</span>
              </div>
            </div>`;

let normRadar = radar.replace(/\r\n/g, '\n');
normRadar = normRadar.replace(oldRadarImports.replace(/\r\n/g, '\n'), newRadarImports);
normRadar = normRadar.replace(oldRadarType.replace(/\r\n/g, '\n'), newRadarType);
normRadar = normRadar.replace(oldRadarMetricsBlock.replace(/\r\n/g, '\n'), newRadarMetricsBlock);

fs.writeFileSync(radarPath, normRadar, 'utf8');
console.log('Successfully updated Radar.tsx');
