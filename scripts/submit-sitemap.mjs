/**
 * Notifica buscadores sobre o sitemap do AxéCloud após deploy.
 *
 * Uso:
 *   npm run submit:sitemap
 *   SITE_URL=https://axecloud.com.br node scripts/submit-sitemap.mjs
 *
 * Variáveis:
 *   SITE_URL — origem canônica (padrão: https://axecloud.com.br)
 */

const DEFAULT_SITE_URL = 'https://axecloud.com.br';

function resolveSiteUrl() {
  const raw = (process.env.SITE_URL || process.env.VITE_SITE_URL || DEFAULT_SITE_URL).trim();
  const parsed = new URL(raw);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`SITE_URL inválida: "${raw}"`);
  }
  return `${parsed.protocol}//${parsed.host}`;
}

/**
 * @param {string} label
 * @param {string} pingUrl
 */
async function pingSearchEngine(label, pingUrl) {
  try {
    const res = await fetch(pingUrl, { method: 'GET', redirect: 'follow' });
    const ok = res.ok || res.status === 204;
    console.log(`[sitemap] ${label}: HTTP ${res.status}${ok ? ' ✓' : ' (resposta inesperada)'}`);
    return ok;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[sitemap] ${label}: falhou — ${message}`);
    return false;
  }
}

function printSearchConsoleGuide(siteUrl, sitemapUrl) {
  console.log('');
  console.log('── Google Search Console (faça uma vez) ──');
  console.log('1. Acesse https://search.google.com/search-console');
  console.log('2. Adicione a propriedade "Prefixo de URL": ' + siteUrl + '/');
  console.log('3. Escolha verificação por "Tag HTML"');
  console.log('4. Copie o valor do atributo content= e coloque no .env:');
  console.log('   GOOGLE_SITE_VERIFICATION=seu_token_aqui');
  console.log('5. Faça deploy (ou reinicie o app na VPS) e clique "Verificar" no Search Console');
  console.log('6. Em "Sitemaps", envie manualmente: sitemap.xml');
  console.log('   URL do sitemap: ' + sitemapUrl);
  console.log('   ⚠ NÃO use sitemap.xm (sem o l) — o Google rejeita como HTML');
  console.log('');
  console.log('Dica: após verificar, use este script após cada deploy: npm run submit:sitemap');
  console.log('KPIs semanais (Search Console + GBP): npm run seo:kpi-checklist');
  console.log('Guia: docs/SEO-KPIS-SEARCH-CONSOLE.md');
  console.log('');
}

async function main() {
  const siteUrl = resolveSiteUrl();
  const sitemapUrl = `${siteUrl.replace(/\/+$/, '')}/sitemap.xml`;
  const encoded = encodeURIComponent(sitemapUrl);

  console.log(`[sitemap] site: ${siteUrl}`);
  console.log(`[sitemap] sitemap: ${sitemapUrl}`);

  const googlePing = `https://www.google.com/ping?sitemap=${encoded}`;
  const bingPing = `https://www.bing.com/ping?sitemap=${encoded}`;

  console.log('[sitemap] ping automático (opcional — Google/Bing podem retornar 404/410; use o Search Console)');
  await pingSearchEngine('Google ping', googlePing);
  await pingSearchEngine('Bing ping', bingPing);

  printSearchConsoleGuide(siteUrl, sitemapUrl);
}

main().catch((err) => {
  console.error('[sitemap] erro fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
