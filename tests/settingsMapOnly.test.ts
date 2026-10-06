import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const settings = readFileSync(new URL('../src/views/Settings.tsx', import.meta.url), 'utf8');
const subnav = readFileSync(new URL('../src/components/settings/SettingsSubNav.tsx', import.meta.url), 'utf8');
const profile = readFileSync(new URL('../src/components/settings/SettingsProfilePanel.tsx', import.meta.url), 'utf8');
const radar = readFileSync(new URL('../src/views/Radar.tsx', import.meta.url), 'utf8');

test('configurações exibem somente os dados do mapa na antiga área pública', () => {
  assert.doesNotMatch(settings, /PortalConsulenteSettings/);
  assert.doesNotMatch(settings, /ClaimedDirectoryProfileSettings/);
  assert.match(radar, /<ClaimedDirectoryProfileSettings \/>/);
  assert.doesNotMatch(subnav, /label: 'Dados do Mapa'/);
});

test('atalho visual do portal público foi removido do perfil da casa', () => {
  assert.doesNotMatch(profile, /onOpenPortal|Portal Público/);
});
