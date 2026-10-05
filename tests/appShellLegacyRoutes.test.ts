import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const worker = readFileSync('cloudflare/app-shell-worker.js', 'utf8');
const config = readFileSync('wrangler.app-production.jsonc', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');

test('worker preserva links antigos do painel e do cadastro', () => {
  for (const [path, tab] of [
    ['/children', 'children'],
    ['/financial', 'financial'],
    ['/calendar', 'calendar'],
    ['/gallery', 'gallery'],
    ['/radar', 'radar'],
    ['/atendimento-agenda', 'atendimento-agenda'],
    ['/camarinha', 'camarinha'],
  ]) {
    assert.match(worker, new RegExp(`\\['${path}', '${tab}'\\]`));
    assert.match(config, new RegExp(`axecloud\\.com\\.br${path.replace('/', '\\/')}\\*`));
  }
  assert.match(worker, /redirect\(`\/register\$\{suffix\}\$\{url\.search\}`/);
  assert.match(config, /axecloud\.com\.br\/cadastro\*/);
  assert.match(worker, /\['\/financial-mensalidades', 'financial-mensalidades'\]/);
  assert.match(config, /axecloud\.com\.br\/financial\*/);
  assert.match(worker, /\['\/consulentes', 'consulentes'\]/);
  assert.match(config, /axecloud\.com\.br\/consulentes\*/);
  assert.match(worker, /\['\/atendimentos', 'consulentes'\]/);
});

test('painel aceita links diretos para todos os módulos da zeladoria', () => {
  for (const tab of [
    'obligations',
    'frequencia',
    'financial-mensalidades',
    'financial-configs',
    'radar',
    'subscription',
    'reports',
    'patrimony',
    'documents',
    'consulentes',
    'atendimento-agenda',
    'journey',
    'liturgical',
    'development',
    'camarinha',
  ]) {
    assert.match(app, new RegExp(`'${tab}'`));
  }
  assert.match(app, /normalizeZeladorDeepLinkTab\(tab\)/);
  assert.match(app, /tab === 'atendimentos' \? 'consulentes'/);
  assert.match(app, /const initialTab = isFilhoAuth/);
  assert.match(app, /normalizeZeladorDeepLinkTab\(requestedTab\)/);
  assert.doesNotMatch(app, /setActiveTab\(isFilhoAuth \? 'profile' : 'dashboard'\)/);
});
