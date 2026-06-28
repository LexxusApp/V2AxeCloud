#!/usr/bin/env node
/**
 * Imprime checklist semanal de KPIs SEO (Search Console + Google Business Profile).
 *
 * Uso: npm run seo:kpi-checklist
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const kpisPath = join(__dirname, '..', 'src', 'constants', 'seoKpis.ts');

/** Extrai blocos estáticos do TS sem transpilar — suficiente para o CLI. */
function loadKpiHints() {
  const src = readFileSync(kpisPath, 'utf8');
  const baseline = src.match(/SEO_KPI_BASELINE_DATE = '([^']+)'/)?.[1] ?? '2026-06-28';
  const indexing = src.match(/baselinePages: (\d+)[\s\S]*?target90d: (\d+)[\s\S]*?target6m: (\d+)/);
  const sitemap = src.match(/sitemapUrl: `\$\{SITE_ORIGIN\}(\/sitemap\.xml)`/);
  return {
    baseline,
    baselinePages: indexing?.[1] ?? '21',
    target90d: indexing?.[2] ?? '25',
    target6m: indexing?.[3] ?? '40',
    sitemapPath: sitemap?.[1] ?? '/sitemap.xml',
  };
}

function main() {
  const site = (process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://axecloud.com.br').replace(
    /\/+$/,
    '',
  );
  const { baseline, baselinePages, target90d, target6m, sitemapPath } = loadKpiHints();

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  AxéCloud — KPIs SEO semanais');
  console.log(`  Baseline: ${baseline} · ${baselinePages} URLs no sitemap`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('Google Search Console → https://search.google.com/search-console');
  console.log(`Sitemap: ${site}${sitemapPath}`);
  console.log('');
  console.log('[ ] Performance (28 dias): impressões · cliques · CTR · posição média');
  console.log('[ ] Indexação → Páginas: contagem "Indexadas"');
  console.log('[ ] Indexação → Sitemaps: status Sucesso');
  console.log('');
  console.log('Consultas (filtro "Consulta contém"):');
  console.log('  [ ] Marca: axecloud · axécloud');
  console.log('  [ ] Genérico: software terreiro · gestão terreiro · sistema terreiro');
  console.log('  [ ] Funcionalidade: mensalidade pix · portal filho de santo · pwa terreiro');
  console.log('  [ ] Comparativo: melhor software terreiro · planilha terreiro');
  console.log('');
  console.log('Páginas (filtro "Página ="):');
  console.log('  [ ] /');
  console.log('  [ ] /por-que-axecloud  (CTR vs home)');
  console.log('  [ ] /programa-fundador');
  console.log('  [ ] /conteudo + artigos Fase 2');
  console.log('');
  console.log('Google Business Profile → https://business.google.com');
  console.log('[ ] Visualizações do perfil (28 dias)');
  console.log('[ ] Cliques no site');
  console.log('[ ] Pesquisas que encontraram o perfil');
  console.log('[ ] 1 post quinzenal (link /programa-fundador ou /conteudo)');
  console.log('');
  console.log(`Meta indexação: ${baselinePages} → ${target90d} (90d) → ${target6m} (6m)`);
  console.log('');
  console.log('Planilha: docs/seo-kpi-snapshot.template.csv');
  console.log('Guia completo: docs/SEO-KPIS-SEARCH-CONSOLE.md');
  console.log('');
}

main();
