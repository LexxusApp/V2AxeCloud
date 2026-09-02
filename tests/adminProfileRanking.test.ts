import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

test('admin oferece ranking acumulado de cliques nos perfis', () => {
  const routes = read('api/admin-console-routes.ts');
  const layout = read('axecloud-admin/src/pages/AdminDashboardLayout.tsx');
  const shell = read('axecloud-admin/src/pages/CommandShell.tsx');
  const panel = read('axecloud-admin/src/pages/ProfileRankingPanel.tsx');
  const publicRoutes = read('api/lib/diretorioPublicRoutes.ts');
  const card = read('src/components/portal/DiretorioTerreiroCard.tsx');
  const directory = read('cinematic-site/terreiros.html');

  assert.match(routes, /\/api\/admin-console\/profile-ranking/);
  assert.match(routes, /from\("access_logs"\)/);
  assert.match(routes, /directory\.profile_click/);
  assert.match(routes, /profilesWithViews/);
  assert.doesNotMatch(routes, /profile-ranking[\s\S]{0,1000}gte\("created_at"/);
  assert.match(layout, /id: "ranking", label: "Ranking"/);
  assert.match(shell, /tab === "ranking"/);
  assert.match(panel, /Cliques acumulados/);
  assert.match(panel, /Total histórico; a contagem não reinicia por dia ou mês/);
  assert.match(publicRoutes, /\/profile-click/);
  assert.match(card, /trackDiretorioProfileClick\(terreiro\.slug\)/);
  assert.match(directory, /data-profile-click/);
  assert.match(directory, /registraCliquePerfil/);
});
