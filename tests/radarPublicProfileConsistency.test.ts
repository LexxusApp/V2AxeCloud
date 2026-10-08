import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const radar = readFileSync(new URL('../src/views/Radar.tsx', import.meta.url), 'utf8');
const publicPage = readFileSync(new URL('../src/views/portal/DiretorioTerreiroPage.tsx', import.meta.url), 'utf8');
const settingsApi = readFileSync(new URL('../api/lib/consulentePortalRoutes.ts', import.meta.url), 'utf8');
const publicationsApi = readFileSync(new URL('../api/lib/directoryProfilePublicationsRoutes.ts', import.meta.url), 'utf8');
const quality = readFileSync(new URL('../lib/diretorioQuality.ts', import.meta.url), 'utf8');
const apiRuntime = readFileSync(new URL('../api/index.ts', import.meta.url), 'utf8');
const serverRuntime = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

test('Radar reúne identidade pública, publicações e atendimentos', () => {
  assert.match(radar, /DirectoryPublicProfileSettings/);
  assert.match(radar, /TerreiroPublicacoesSettings/);
  assert.match(radar, /TerreiroServicosSettings/);
  assert.match(settingsApi, /cover_photo_url/);
  assert.match(settingsApi, /gallery_photo_urls/);
  assert.match(settingsApi, /orientacoes_visita/);
  assert.match(settingsApi, /publicacao_status/);
});

test('perfil público usa capa, galeria, orientações, publicações e aba de atendimentos', () => {
  assert.match(publicPage, /terreiro\.coverPhotoUrl \|\| terreiro\.fotoUrl/);
  assert.match(publicPage, /terreiro\.galleryPhotoUrls/);
  assert.match(publicPage, /terreiro\.orientacoesVisita/);
  assert.match(publicPage, /publications\.map/);
  assert.match(publicPage, /id: 'atendimentos'/);
});

test('visibilidade e rotas de publicações ficam protegidas nos dois runtimes', () => {
  assert.match(quality, /publicationStatus && publicationStatus !== 'publicado'/);
  assert.match(publicationsApi, /claimed_by_tenant_id/);
  assert.match(publicationsApi, /\.eq\("terreiro_id", terreiro\.id\)/);
  assert.match(apiRuntime, /registerDirectoryProfilePublicationsRoutes/);
  assert.match(serverRuntime, /registerDirectoryProfilePublicationsRoutes/);
});
