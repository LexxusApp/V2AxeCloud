/**
 * KPIs de SEO — Search Console + Google Business Profile.
 * Fonte única para checklist semanal, docs e scripts (`npm run seo:kpi-checklist`).
 *
 * Baseline: jun/2026 (pós Fase 1 comparativo + Fase 2 conteúdo).
 */

import { SITE_ORIGIN } from './seoHome';

export const SEO_KPI_BASELINE_DATE = '2026-06-28' as const;

export type SeoKpiQueryGroup = {
  id: string;
  label: string;
  /** Termos para filtrar em Performance → Resultados da pesquisa → Consulta */
  queries: readonly string[];
  /** Meta de impressões / posição (texto humano para a planilha) */
  target90d: string;
  target6m: string;
};

export type SeoKpiPageTarget = {
  /** Caminho relativo (sem origem) */
  path: string;
  label: string;
  /** Por que monitorar esta URL */
  note: string;
};

export type GbpKpiMetric = {
  id: string;
  label: string;
  /** Onde encontrar no painel do Perfil da Empresa no Google */
  gbpPath: string;
  target90d: string;
};

/** Grupos de consulta para comparar semana a semana no GSC. */
export const SEO_KPI_QUERY_GROUPS: readonly SeoKpiQueryGroup[] = [
  {
    id: 'brand',
    label: 'Marca',
    queries: ['axecloud', 'axécloud', 'axe cloud', 'axecloud terreiro'],
    target90d: 'Posição média ≤ 1,5 · CTR ≥ 35%',
    target6m: 'Manter #1 em todas as grafias da marca',
  },
  {
    id: 'generic-product',
    label: 'Produto genérico',
    queries: [
      'software gestão terreiro',
      'software para terreiro',
      'sistema para terreiro',
      'gestão terreiro',
      'sistema gestão terreiro umbanda',
    ],
    target90d: 'Impressões +30% vs baseline · posição média ≤ 8',
    target6m: 'Top 3 em pelo menos 2 termos deste grupo',
  },
  {
    id: 'feature-intent',
    label: 'Intenção de funcionalidade',
    queries: [
      'mensalidade terreiro pix',
      'portal filho de santo',
      'app terreiro celular',
      'pwa terreiro',
      'whatsapp terreiro',
    ],
    target90d: '≥ 1 página do /conteudo com impressões em cada sub-tema',
    target6m: 'CTR ≥ 4% em páginas de conteúdo correspondentes',
  },
  {
    id: 'comparison',
    label: 'Comparativo / decisão',
    queries: [
      'melhor software terreiro',
      'planilha ou software terreiro',
      'comparar software terreiro',
      'kanzua',
      'terreiroadmin',
    ],
    target90d: '/por-que-axecloud indexada · ≥ 50 impressões/mês',
    target6m: 'Posição ≤ 5 para "melhor software terreiro"',
  },
] as const;

/** Páginas prioritárias — comparar CTR e impressões entre elas. */
export const SEO_KPI_PAGE_TARGETS: readonly SeoKpiPageTarget[] = [
  {
    path: '/',
    label: 'Home',
    note: 'Principal entrada orgânica de marca e termos amplos',
  },
  {
    path: '/por-que-axecloud',
    label: 'Comparativo',
    note: 'CTR vs home em consultas de decisão; meta: CTR ≥ 5% quando posição ≤ 10',
  },
  {
    path: '/register',
    label: 'Cadastro (trial)',
    note: 'Conversão orgânica — meta principal pós-remoção do Programa Fundador público',
  },
  {
    path: '/conteudo',
    label: 'Hub de conteúdo',
    note: 'Entrada para cluster de autoridade (Fase 2)',
  },
  {
    path: '/conteudo/planilha-ou-software-quando-migrar-gestao-terreiro',
    label: 'Artigo planilha vs software',
    note: 'Top of funnel — termo "planilha terreiro"',
  },
  {
    path: '/conteudo/melhor-software-terreiro-2026-o-que-avaliar',
    label: 'Artigo melhor software 2026',
    note: 'Bottom of funnel comparativo',
  },
  {
    path: '/conteudo/como-instalar-axecloud-celular-pwa',
    label: 'Artigo PWA',
    note: 'Intenção app/celular',
  },
  {
    path: '/register',
    label: 'Cadastro',
    note: 'Último clique antes da conversão (se indexado)',
  },
] as const;

export const SEO_KPI_INDEXING = {
  baselinePages: 20,
  target90d: 25,
  target6m: 40,
  /** URLs novas da Fase 2 — pedir indexação manual se "URL não está no Google" */
  priorityInspectPaths: [
    '/por-que-axecloud',
    '/conteudo/planilha-ou-software-quando-migrar-gestao-terreiro',
    '/conteudo/como-instalar-axecloud-celular-pwa',
    '/conteudo/whatsapp-oficial-vs-grupos-comunicacao-terreiro',
    '/conteudo/melhor-software-terreiro-2026-o-que-avaliar',
  ],
  sitemapUrl: `${SITE_ORIGIN}/sitemap.xml`,
} as const;

/** Métricas do Google Business Profile (Perfil da Empresa). */
export const GBP_KPI_METRICS: readonly GbpKpiMetric[] = [
  {
    id: 'profile-views',
    label: 'Visualizações do perfil',
    gbpPath: 'Desempenho → Visualizações',
    target90d: 'Tendência estável ou crescente semana a semana',
  },
  {
    id: 'search-views',
    label: 'Pesquisas que encontraram o perfil',
    gbpPath: 'Desempenho → Como os clientes encontraram você → Pesquisa',
    target90d: 'Registrar termos (marca + "software terreiro" se aparecer)',
  },
  {
    id: 'website-clicks',
    label: 'Cliques no site',
    gbpPath: 'Desempenho → Cliques no site',
    target90d: '≥ 5 cliques/semana quando houver impressões',
  },
  {
    id: 'direction-calls',
    label: 'Chamadas / mensagens',
    gbpPath: 'Desempenho → Chamadas · Mensagens',
    target90d: 'Registrar volume (SaaS: pode ser baixo — ok)',
  },
  {
    id: 'posts',
    label: 'Publicações no perfil',
    gbpPath: 'Adicionar atualização / Novidades',
    target90d: '1 post quinzenal com link para /por-que-axecloud ou artigo novo',
  },
] as const;

export type WeeklySeoKpiSnapshot = {
  weekOf: string;
  gsc: {
    totalImpressions: number | null;
    totalClicks: number | null;
    avgCtrPct: number | null;
    avgPosition: number | null;
    indexedPages: number | null;
    queryGroups: Record<string, { impressions: number | null; avgPosition: number | null }>;
    pages: Record<string, { impressions: number | null; ctrPct: number | null; avgPosition: number | null }>;
  };
  gbp: Record<string, number | null>;
  notes: string;
};

/** Cabeçalho CSV para planilha (Google Sheets / Excel). */
export const SEO_KPI_CSV_HEADERS = [
  'semana',
  'gsc_impressoes_total',
  'gsc_cliques_total',
  'gsc_ctr_pct',
  'gsc_posicao_media',
  'gsc_paginas_indexadas',
  'gsc_impressoes_marca',
  'gsc_impressoes_generico',
  'gsc_ctr_home_pct',
  'gsc_ctr_comparativo_pct',
  'gbp_visualizacoes',
  'gbp_cliques_site',
  'notas',
] as const;

/** Rotina semanal (~10 min) — texto para CLI e docs. */
export function buildWeeklySeoKpiChecklistLines(): string[] {
  const lines: string[] = [
    `Checklist SEO semanal — baseline ${SEO_KPI_BASELINE_DATE}`,
    '',
    '── Google Search Console (Performance → Resultados da pesquisa, últimos 28 dias) ──',
    '1. Anotar: impressões totais, cliques, CTR médio, posição média',
    '2. Páginas indexadas: Indexação → Páginas (contagem "Indexadas")',
    `3. Sitemap: Indexação → Sitemaps → ${SEO_KPI_INDEXING.sitemapUrl} (status "Sucesso")`,
    '',
    'Consultas (filtrar "Consulta contém"):',
  ];

  for (const group of SEO_KPI_QUERY_GROUPS) {
    lines.push(`  • [${group.label}] ${group.queries.slice(0, 3).join(' · ')}… → meta 90d: ${group.target90d}`);
  }

  lines.push('', 'Páginas (filtrar "Página ="):');
  for (const page of SEO_KPI_PAGE_TARGETS.slice(0, 6)) {
    lines.push(`  • ${page.path} — ${page.note}`);
  }

  lines.push(
    '',
    '── Google Business Profile (Desempenho, últimos 28 dias) ──',
    'Perfil já criado — anotar:',
  );
  for (const m of GBP_KPI_METRICS) {
    lines.push(`  • ${m.label} (${m.gbpPath}) → ${m.target90d}`);
  }

  lines.push(
    '',
    '── Ações se algo estiver abaixo da meta ──',
    '• URL nova sem indexação: Inspeção de URL → Solicitar indexação',
    '• CTR baixo com posição ≤ 10: revisar title/description da página',
    '• Impressões zero em termo genérico: reforçar link interno a partir de /conteudo e /por-que-axecloud',
    '• GBP: post quinzenal + link do site apontando para axecloud.com.br (mesmo domínio verificado no GSC)',
    '',
    `Meta indexação: ${SEO_KPI_INDEXING.baselinePages} → ${SEO_KPI_INDEXING.target90d} (90d) → ${SEO_KPI_INDEXING.target6m} (6m)`,
    '',
    'Planilha: docs/seo-kpi-snapshot.template.csv',
  );

  return lines;
}

export function formatWeeklySeoKpiChecklist(): string {
  return buildWeeklySeoKpiChecklistLines().join('\n');
}
