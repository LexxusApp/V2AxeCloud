/**
 * Gera o PDF do plano de execucao de performance do AxeCloud.
 *
 * Uso:
 *   node scripts/generate-performance-plan-pdf.mjs
 *
 * Saida: docs/plano-performance-axecloud.pdf
 *
 * Bibliotecas: pdfkit puro (sem Chromium / sem dependencia nativa pesada).
 */

import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'docs', 'plano-performance-axecloud.pdf');

// ----- Paleta -----
const COLORS = {
  ink: '#0f172a',
  body: '#1e293b',
  muted: '#64748b',
  faint: '#94a3b8',
  accent: '#FBBC00',
  accentInk: '#7c5a00',
  rule: '#e2e8f0',
  zebra: '#f8fafc',
  good: '#15803d',
  warn: '#c2410c',
};

// ----- Layout -----
const PAGE_MARGIN = 56;
const CONTENT_WIDTH = 595.28 - PAGE_MARGIN * 2; // A4 width - margens

// ----- Conteudo do plano -----
const today = new Date().toLocaleDateString('pt-BR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

const TOC = [
  { id: 1, title: 'Indices SQL', impact: 'altissimo', effort: 'baixo' },
  { id: 2, title: 'Code splitting das views', impact: 'altissimo', effort: 'baixo' },
  { id: 3, title: 'Cache HTTP em endpoints estaveis', impact: 'alto', effort: 'baixo' },
  { id: 4, title: 'select() enxuto + paralelismo', impact: 'medio', effort: 'medio' },
  { id: 5, title: 'PWA cache strategy ajustado', impact: 'baixo', effort: 'baixo' },
  { id: 6, title: 'SWR global nas views', impact: 'alto', effort: 'maior' },
];

const PHASES = [
  {
    n: 1,
    title: 'Indices SQL',
    gain: 'ganho 50-500 ms por query',
    risk: 'Zero risco. Indexes usam CREATE INDEX IF NOT EXISTS e CONCURRENTLY onde aplicavel - nao bloqueiam leituras nem escritas.',
    file: 'supabase/migrations/20260514200000_performance_indexes.sql',
    body: 'Migration nova com indexes para tabelas mais lidas. Atualmente faltam indexes criticos em perfil_lider, filhos_de_santo, financeiro, mural_avisos, calendario_axe e subscriptions - todas usadas em quase todas as paginas.',
    table: {
      headers: ['Tabela', 'Index', 'Por que'],
      rows: [
        ['perfil_lider', '(tenant_id)', 'Lookup em todas queries de tenant'],
        ['perfil_lider', '(id, tenant_id) composto', 'OR de resolveTenantFromSupabase'],
        ['filhos_de_santo', '(tenant_id)', 'Listagem em Children'],
        ['filhos_de_santo', '(lider_id)', 'Vinculo filho->zelador'],
        ['filhos_de_santo', '(user_id)', 'loadAllTenantData (filho)'],
        ['filhos_de_santo', '(email)', 'Fallback por email em login'],
        ['financeiro', '(tenant_id, data DESC)', 'Listagens ordenadas'],
        ['financeiro', '(tenant_id, status)', 'Filtro pendente/pago'],
        ['mural_avisos', '(tenant_id, created_at DESC)', 'NoticeBoard e Painel de Notificacoes'],
        ['calendario_axe', '(tenant_id, data DESC)', 'Calendar e Dashboard'],
        ['calendario_axe', '(tipo)', 'Filtro Obrigacao'],
        ['subscriptions', '(user_id)', 'Settings e Subscription'],
      ],
    },
    requires: 'Rodar a migration manualmente no Supabase (dashboard > SQL editor) ou via supabase CLI.',
  },
  {
    n: 2,
    title: 'Code splitting das views',
    gain: 'ganho 1-3 s no primeiro carregamento',
    risk: 'Baixo. Posso adicionar prefetch no hover do menu da sidebar para evitar qualquer flicker ao trocar de aba.',
    file: 'src/App.tsx (~30 linhas alteradas)',
    body: 'Trocar imports estaticos linhas 4-19 por React.lazy + Suspense. O bundle inicial cai de ~900 KB para ~250 KB. Cada view vira chunk separado de 30-80 KB carregado on-demand.',
    bullets: [
      'Logged-in usuario ve Dashboard em ~1.2 s vs ~3 s hoje (rede 4G media)',
      'Cada view e cacheada no navegador na 2a abertura - troca de aba instantanea',
      'Login, Sidebar, NotificationPanel e LuxuryLoading nao viram lazy (sao always-on)',
      'Recharts pode ser lazy dentro de Dashboard/Financial (corta mais 120 KB)',
    ],
  },
  {
    n: 3,
    title: 'Cache HTTP em endpoints estaveis',
    gain: 'ganho 200-500 ms por navegacao',
    risk: 'Baixo. stale-while-revalidate garante que dado eventualmente revalida. Tempos curtos (10-300s).',
    file: 'api/index.ts e api/tenant-info.ts',
    body: 'Adicionar Cache-Control em endpoints cujo conteudo e estavel por segundos/minutos. Hoje todas as chamadas pagam ~200-600 ms de cold start + ~50-150 ms de createClient Supabase + RLS.',
    table: {
      headers: ['Endpoint', 'Cache-Control', 'Estabilidade'],
      rows: [
        ['/api/tenant-info', 'private, max-age=30, swr=120', 'Plano/tenant muda raramente'],
        ['/api/plans-catalog', 'public, s-maxage=300, swr=3600', 'Catalogo global - cacheado no edge Vercel'],
        ['/api/v1/financial/pix-config', 'private, max-age=60, swr=300', 'Config manual'],
        ['/api/children', 'private, max-age=10, swr=60', 'Lista de filhos relativamente estavel'],
      ],
    },
    bullets: [
      'NAO cachear: /api/transactions, /api/auth/*, /api/admin/*, mutations (POST/PUT/DELETE)',
      's-maxage = cache no CDN da Vercel (edge - ~10 ms vs ~500 ms)',
      'swr = stale-while-revalidate: serve cache na hora, revalida em background',
    ],
  },
  {
    n: 4,
    title: 'select() enxuto + paralelismo',
    gain: 'ganho 100-300 ms por tela com muitos dados',
    risk: 'Medio. Preciso garantir que nenhum componente downstream usa coluna removida do select. Faco grep cuidadoso antes de cada mudanca.',
    file: 'views/Children.tsx, Calendar.tsx, Library.tsx, NoticeBoard.tsx + App.tsx::loadAllTenantData',
    body: 'Refatorar queries que usam select("*") em listagens. Trafegar so o necessario reduz payload em 60-80% em telas com muitos registros, alem de baixar JSON parse e tempo de transmissao em rede movel.',
    table: {
      headers: ['Arquivo', 'Hoje', 'Depois'],
      rows: [
        ['Children.tsx', 'select("*")', 'select("id, nome, foto_url, cargo, ativo, created_at")'],
        ['Calendar.tsx', 'select("*")', 'so campos da listagem'],
        ['Library.tsx', 'select("*")', 'so metadados (sem blob)'],
        ['NoticeBoard.tsx', 'select("*")', 'sem comentarios (lazy ao expandir)'],
        ['loadAllTenantData', 'queries sequenciais', 'Promise.all paralelo'],
      ],
    },
  },
  {
    n: 5,
    title: 'PWA cache strategy ajustado',
    gain: 'ganho 50-150 ms em revisitas (assets servidos do cache local em vez de revalidar)',
    risk: 'Baixo. Assets com hash sao imutaveis por construcao - CacheFirst e seguro.',
    file: 'vite.config.ts',
    body: 'Hoje TUDO usa NetworkFirst. Isso revalida assets imutaveis em cada navegacao desnecessariamente. Diferenciar por tipo de recurso e mais eficiente.',
    table: {
      headers: ['Tipo de asset', 'Estrategia ideal'],
      rows: [
        ['JS/CSS com hash em /assets/', 'CacheFirst (1 ano)'],
        ['Imagens estaticas (icones PWA)', 'CacheFirst (30 dias)'],
        ['Navegacao HTML', 'NetworkFirst (continua igual)'],
        ['Chamadas /api/*', 'NetworkOnly (deixa Cache-Control HTTP decidir)'],
        ['Imagens de usuario (R2/Supabase)', 'StaleWhileRevalidate (1 dia)'],
      ],
    },
  },
  {
    n: 6,
    title: 'SWR global nas views',
    gain: 'ganho de PERCEPCAO - aplicacao parece instantanea no fluxo do dia-a-dia',
    risk: 'Medio. Mexe em mais arquivos. Faco uma view por vez com teste manual entre cada.',
    file: 'views/Children, Calendar, NoticeBoard, Library, Store, Inventory (~6 arquivos)',
    body: 'Trocar useEffect + fetch + useState por useSWR. Hoje so o Financial.tsx usa SWR - o resto refetch tudo a cada troca de aba.',
    bullets: [
      'Dedup automatico: 2 componentes pedindo o mesmo dado -> 1 request',
      'Stale-while-revalidate: dado cacheado aparece na hora, revalida em background',
      'Revalidate on focus: dado fresco sem o usuario apertar reload',
      'Cache compartilhado entre Dashboard e Financial (transacoes sao as mesmas)',
      'Remove boilerplate de loading/error em cada view',
    ],
  },
];

const SCHEDULE = [
  ['1. Indices SQL', '10 min', 'rodar 1 migration no Supabase', '5/5'],
  ['2. Code splitting', '20 min', 'nada (deploy automatico)', '5/5'],
  ['3. Cache HTTP', '15 min', 'nada', '4/5'],
  ['4. Select enxuto', '30 min', 'nada', '3/5'],
  ['5. PWA strategy', '10 min', 'nada', '2/5'],
  ['6. SWR global', '1-2 h', 'testar visualmente cada view', '4/5'],
];

// =========================================================
// PDFKit setup
// =========================================================
const doc = new PDFDocument({
  size: 'A4',
  margin: PAGE_MARGIN,
  bufferPages: true,
  info: {
    Title: 'Plano de execucao - Otimizacao de performance AxeCloud',
    Author: 'AxeCloud / Cursor',
    Subject: 'Roadmap em 6 fases para acelerar leituras e abertura de paginas',
    Keywords: 'axecloud performance supabase react',
    CreationDate: new Date(),
  },
});

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
const stream = fs.createWriteStream(OUTPUT);
doc.pipe(stream);

// ---------- Helpers ----------
function drawHr(yOffset = 6, color = COLORS.rule) {
  const y = doc.y + yOffset;
  doc.moveTo(PAGE_MARGIN, y).lineTo(595.28 - PAGE_MARGIN, y).strokeColor(color).lineWidth(0.7).stroke();
  doc.moveDown(0.8);
}

function ensureSpace(needed) {
  if (doc.y + needed > 842 - PAGE_MARGIN - 30) {
    doc.addPage();
  }
}

function chip(text, x, y, fill, textColor) {
  const padX = 6;
  const padY = 3;
  doc.font('Helvetica-Bold').fontSize(8);
  const w = doc.widthOfString(text) + padX * 2;
  const h = 14;
  doc.roundedRect(x, y, w, h, 3).fillColor(fill).fill();
  doc.fillColor(textColor).text(text, x + padX, y + padY - 1, { width: w - padX * 2, lineBreak: false });
  doc.fillColor(COLORS.body);
  return { w, h };
}

function H1(text) {
  ensureSpace(40);
  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor(COLORS.ink)
    .text(text, { paragraphGap: 4 });
  doc.fillColor(COLORS.body);
}

function H2(text) {
  ensureSpace(36);
  doc.moveDown(0.6);
  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor(COLORS.ink)
    .text(text);
  doc.fillColor(COLORS.body);
}

function H3(text) {
  ensureSpace(22);
  doc.moveDown(0.3);
  doc
    .font('Helvetica-Bold')
    .fontSize(10.5)
    .fillColor(COLORS.muted)
    .text(text.toUpperCase(), { characterSpacing: 0.6 });
  doc.fillColor(COLORS.body);
}

function P(text, opts = {}) {
  ensureSpace(20);
  doc
    .font('Helvetica')
    .fontSize(10.5)
    .fillColor(COLORS.body)
    .text(text, { lineGap: 2.5, ...opts });
}

function Bullets(items) {
  doc.font('Helvetica').fontSize(10.5).fillColor(COLORS.body);
  for (const it of items) {
    ensureSpace(18);
    const x = PAGE_MARGIN;
    const y = doc.y;
    doc.circle(x + 3, y + 5.5, 1.5).fillColor(COLORS.accent).fill();
    doc.fillColor(COLORS.body).text(it, x + 12, y, { width: CONTENT_WIDTH - 12, lineGap: 2.5 });
    doc.moveDown(0.15);
  }
}

function Callout(label, text, color = COLORS.accent) {
  ensureSpace(50);
  const x = PAGE_MARGIN;
  const startY = doc.y;
  const innerX = x + 14;
  const innerW = CONTENT_WIDTH - 18;
  // medir
  const labelH = 12;
  doc.font('Helvetica').fontSize(10);
  const textH = doc.heightOfString(text, { width: innerW });
  const totalH = labelH + textH + 16;
  doc.roundedRect(x, startY, CONTENT_WIDTH, totalH, 5).fillColor('#fff8e6').fill();
  doc.rect(x, startY, 4, totalH).fillColor(color).fill();
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(COLORS.accentInk)
    .text(label.toUpperCase(), innerX, startY + 8, { characterSpacing: 0.6, width: innerW });
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(COLORS.body)
    .text(text, innerX, startY + 8 + labelH + 4, { width: innerW, lineGap: 2 });
  doc.y = startY + totalH + 8;
  doc.fillColor(COLORS.body);
}

function drawTable(headers, rows, columnsPct) {
  const widths = columnsPct.map((p) => Math.round((p / 100) * CONTENT_WIDTH));
  const cellPad = 6;
  const rowMinH = 18;
  const lineHeight = 12;

  function measureRow(values, font, size) {
    doc.font(font).fontSize(size);
    let maxH = 0;
    values.forEach((v, i) => {
      const h = doc.heightOfString(String(v), { width: widths[i] - cellPad * 2 });
      if (h > maxH) maxH = h;
    });
    return Math.max(rowMinH, maxH + cellPad * 2);
  }

  function drawRow(values, y, font, size, fill, textColor) {
    let x = PAGE_MARGIN;
    const h = measureRow(values, font, size);
    if (fill) {
      doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, h).fillColor(fill).fill();
    }
    doc.font(font).fontSize(size).fillColor(textColor);
    values.forEach((v, i) => {
      doc.text(String(v), x + cellPad, y + cellPad - 1, {
        width: widths[i] - cellPad * 2,
        lineGap: lineHeight - 12,
      });
      x += widths[i];
    });
    // grade vertical sutil
    x = PAGE_MARGIN;
    for (let i = 0; i < widths.length; i++) {
      x += widths[i];
      if (i < widths.length - 1) {
        doc.moveTo(x, y).lineTo(x, y + h).strokeColor(COLORS.rule).lineWidth(0.5).stroke();
      }
    }
    doc.moveTo(PAGE_MARGIN, y + h).lineTo(PAGE_MARGIN + CONTENT_WIDTH, y + h).strokeColor(COLORS.rule).lineWidth(0.5).stroke();
    return h;
  }

  // header
  ensureSpace(40);
  const headerH = measureRow(headers, 'Helvetica-Bold', 9);
  if (doc.y + headerH > 842 - PAGE_MARGIN - 20) doc.addPage();
  let y = doc.y;
  doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + CONTENT_WIDTH, y).strokeColor(COLORS.muted).lineWidth(0.8).stroke();
  drawRow(headers, y, 'Helvetica-Bold', 9, '#eef2f7', COLORS.ink);
  y += headerH;

  rows.forEach((r, idx) => {
    const rowH = measureRow(r, 'Helvetica', 9);
    if (y + rowH > 842 - PAGE_MARGIN - 20) {
      doc.addPage();
      y = doc.y;
      drawRow(headers, y, 'Helvetica-Bold', 9, '#eef2f7', COLORS.ink);
      y += headerH;
    }
    drawRow(r, y, 'Helvetica', 9, idx % 2 === 0 ? '#ffffff' : COLORS.zebra, COLORS.body);
    y += rowH;
  });

  doc.y = y + 6;
  doc.fillColor(COLORS.body);
}

function impactStars(level) {
  const map = { altissimo: 5, alto: 4, medio: 3, baixo: 2 };
  const n = map[level] || 3;
  return '\u2605'.repeat(n) + '\u2606'.repeat(5 - n);
}

// =========================================================
// CAPA
// =========================================================
doc.rect(0, 0, 595.28, 220).fillColor('#0f172a').fill();
doc.fillColor(COLORS.accent).rect(0, 220, 595.28, 4).fill();

doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.accent)
   .text('AXECLOUD - ENGENHARIA', PAGE_MARGIN, 64, { characterSpacing: 2 });

doc.font('Helvetica-Bold').fontSize(28).fillColor('#ffffff')
   .text('Plano de execucao', PAGE_MARGIN, 92, { width: CONTENT_WIDTH });

doc.font('Helvetica').fontSize(18).fillColor('#cbd5e1')
   .text('Otimizacao de performance', PAGE_MARGIN, 130, { width: CONTENT_WIDTH });

doc.font('Helvetica').fontSize(10.5).fillColor('#94a3b8')
   .text(`Documento gerado em ${today}`, PAGE_MARGIN, 178);

doc.y = 244;
doc.fillColor(COLORS.body);

H3('Resumo executivo');
P(
  'O AxeCloud tem 4 gargalos identificados que somados respondem pela percepcao de lentidao ' +
  'ao abrir paginas: bundle inicial grande, falta de indices em tabelas quentes, ausencia de cache ' +
  'HTTP em endpoints estaveis e ausencia de cache/dedup no cliente. Este documento descreve um plano ' +
  'em 6 fases independentes, com estimativa de esforco e impacto, para resolver cada um deles.'
);
P(
  'Total de mexida: ~2.5-3 h. Ganho composto esperado: a aplicacao 3-5x mais "snappy" no fluxo real de uso.'
);

doc.moveDown(0.4);
H3('Indice');
TOC.forEach((it) => {
  ensureSpace(20);
  const y = doc.y;
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(COLORS.ink)
     .text(`Fase ${it.id}.`, PAGE_MARGIN, y, { width: 50, continued: false });
  doc.font('Helvetica').fontSize(10.5).fillColor(COLORS.body)
     .text(it.title, PAGE_MARGIN + 56, y, { width: CONTENT_WIDTH - 56 });
  doc.moveDown(0.1);
});

doc.addPage();

// =========================================================
// FASES
// =========================================================
PHASES.forEach((phase) => {
  // Banner da fase
  const bannerY = doc.y;
  doc.rect(PAGE_MARGIN, bannerY, CONTENT_WIDTH, 56).fillColor('#0f172a').fill();
  doc.rect(PAGE_MARGIN, bannerY, 4, 56).fillColor(COLORS.accent).fill();
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.accent)
     .text(`FASE ${String(phase.n).padStart(2, '0')}`, PAGE_MARGIN + 16, bannerY + 10, { characterSpacing: 2 });
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#ffffff')
     .text(phase.title, PAGE_MARGIN + 16, bannerY + 26, { width: CONTENT_WIDTH - 24 });
  doc.y = bannerY + 56 + 10;

  // Chips de meta
  const chipY = doc.y;
  const c1 = chip(`Ganho: ${phase.gain}`, PAGE_MARGIN, chipY, '#ecfdf5', COLORS.good);
  chip(`Arquivo: ${phase.file}`, PAGE_MARGIN + c1.w + 8, chipY, '#eff6ff', '#1d4ed8');
  doc.y = chipY + 22;

  // Descricao
  doc.moveDown(0.2);
  P(phase.body);

  if (phase.bullets) {
    H3('Detalhes');
    Bullets(phase.bullets);
  }

  if (phase.table) {
    H3('Detalhamento');
    const cols = phase.table.headers.length === 3 ? [24, 33, 43] : [38, 62];
    drawTable(phase.table.headers, phase.table.rows, cols);
  }

  if (phase.requires) {
    Callout('Acao manual necessaria', phase.requires, COLORS.warn);
  }

  Callout('Risco', phase.risk);

  // gap entre fases
  if (phase.n < PHASES.length) {
    doc.moveDown(0.8);
    drawHr(0);
    doc.moveDown(0.5);
  }
});

// =========================================================
// CRONOGRAMA
// =========================================================
doc.addPage();
H1('Cronograma sugerido');
P(
  'As fases sao independentes e podem ser executadas em paralelo ou em ordens diferentes. ' +
  'Recomendo seguir a ordem do plano - cada fase entrega valor isolado e a primeira ja ' +
  'reduz drasticamente o tempo de abertura de paginas.'
);
doc.moveDown(0.4);

drawTable(
  ['Fase', 'Esforco', 'O que voce faz', 'Impacto'],
  SCHEDULE,
  [38, 14, 36, 12],
);

doc.moveDown(0.5);
H2('Recomendacoes de execucao');
Bullets([
  'Fast track (Fases 1-3): ~45 min de trabalho, entrega ~70% do ganho. So mexe em infra (migration SQL + bundling + headers HTTP).',
  'Completo (Fases 1-5 hoje, Fase 6 depois): da espaco para testar cada view do SWR com calma.',
  'Customizado: voce escolhe quais fases - todas sao independentes e ja existem revisoes incrementais sem efeito colateral.',
]);

doc.moveDown(0.4);
H2('Como medir o ganho');
Bullets([
  'Lighthouse / PageSpeed Insights: rodar antes/depois de cada fase. Metricas a observar: LCP, TTI, TBT.',
  'Network tab do DevTools: tempo de "DOMContentLoaded" cai diretamente apos Fase 2.',
  'Supabase dashboard > Database > Query Performance: tempo medio de queries cai apos Fase 1.',
  'Vercel Speed Insights (ja instalado): metricas reais de usuario chegam em 24-48h apos deploy.',
]);

// =========================================================
// FOOTER + paginacao
// =========================================================
const range = doc.bufferedPageRange();
for (let i = 0; i < range.count; i++) {
  doc.switchToPage(range.start + i);
  const pageNum = i + 1;
  const total = range.count;
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.faint)
     .text(
       `AxeCloud Performance Plan  |  ${today}  |  pagina ${pageNum} de ${total}`,
       PAGE_MARGIN,
       842 - PAGE_MARGIN + 20,
       { width: CONTENT_WIDTH, align: 'center', lineBreak: false }
     );
}

doc.end();

stream.on('finish', () => {
  console.log(`OK -> ${path.relative(ROOT, OUTPUT)}`);
});
stream.on('error', (err) => {
  console.error('Falha ao escrever PDF:', err);
  process.exit(1);
});
