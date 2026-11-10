import test, {type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {readFileSync} from 'node:fs';
import {earlyPwaCapture, pilotPwaPlugin} from '../scripts/pilot-pwa.mjs';

function mockProperty(t: TestContext, target: object, key: string, value: unknown) {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, {configurable: true, value});
  t.after(() => {if (descriptor) Object.defineProperty(target, key, descriptor); else Reflect.deleteProperty(target, key);});
}

test('PWA: captura antecipada, desktop, cancelamento, nova tentativa e instalação', async t => {
  const win = Object.assign(new EventTarget(), {
    matchMedia: () => Object.assign(new EventTarget(), {matches: false}),
    setTimeout: () => 0,
    navigator: {},
  });
  mockProperty(t, globalThis, 'window', win);
  mockProperty(t, globalThis, 'document', Object.assign(new EventTarget(), {visibilityState: 'visible'}));
  mockProperty(t, globalThis, 'navigator', {userAgent: 'Chrome desktop', maxTouchPoints: 0});
  const capture = () => runInNewContext(earlyPwaCapture, {window: win, Event});
  capture();
  let calls = 0;
  function offer(outcome: 'accepted' | 'dismissed', fails = false) {
    const event = Object.assign(new Event('beforeinstallprompt', {cancelable: true}), {
      prompt: async () => { calls++; if (fails) throw Error('expired'); },
      userChoice: Promise.resolve({outcome, platform: 'web'}),
    });
    win.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
  }
  offer('dismissed'); // Antes de o React e o controller carregarem.
  const controller = await import('../src/lib/pwaInstallController');
  controller.initPwaInstallController();
  assert.equal(controller.getPwaInstallSnapshot().canInstall, true);
  assert.strictEqual(controller.getPwaInstallSnapshot(), controller.getPwaInstallSnapshot());
  assert.equal(await controller.triggerPwaInstall(), 'dismissed');
  assert.equal(controller.getPwaInstallSnapshot().canInstall, false);
  assert.equal(await controller.triggerPwaInstall(), 'unavailable');
  assert.equal(calls, 1, 'evento cancelado não é reutilizado');
  assert.equal((win as any).__axecloudDeferredInstall, null);
  offer('accepted', true);
  assert.equal(await controller.triggerPwaInstall(), 'unavailable', 'falha não vira rejeição não tratada');
  offer('accepted');
  const pending = controller.triggerPwaInstall();
  assert.equal(await controller.triggerPwaInstall(), 'unavailable', 'duplo clique não abre duas instalações');
  assert.equal(await pending, 'accepted');
  assert.equal(controller.getPwaInstallSnapshot().isInstalled, false, 'aceitar não confirma instalação concluída');
  win.dispatchEvent(new Event('appinstalled'));
  assert.equal(controller.getPwaInstallSnapshot().isInstalled, true);
  assert.equal(controller.getPwaInstallSnapshot().canInstall, false);
  assert.equal((win as any).__axecloudDeferredInstall, null);
});

test('PWA: identifica iPhone, iPad em modo desktop e aplicativo instalado', async t => {
  const {isIosPwaDevice, isStandalonePwa} = await import('../src/lib/pwaInstall');
  for (const userAgent of ['iPhone', 'iPad', 'Macintosh']) {
    mockProperty(t, globalThis, 'navigator', {userAgent, maxTouchPoints: 5});
    assert.equal(isIosPwaDevice(), true);
  }
  mockProperty(t, globalThis, 'navigator', {userAgent: 'Macintosh', maxTouchPoints: 0});
  assert.equal(isIosPwaDevice(), false);
  mockProperty(t, globalThis, 'window', {matchMedia: () => ({matches: false}), navigator: {standalone: true}});
  assert.equal(isStandalonePwa(), true);
  mockProperty(t, globalThis, 'window', {matchMedia: (query: string) => ({matches: query.includes('standalone')}), navigator: {}});
  assert.equal(isStandalonePwa(), true);
});

test('PWA: outro webapp ou domínio parecido não esconde instalação do AxéCloud', async t => {
  const {isInstalledRelatedWebApp} = await import('../src/lib/pwaInstall');
  for (const [apps, installed] of [
    [[{platform: 'webapp', id: 'outro'}], false],
    [[{platform: 'webapp', url: 'https://axecloud.com.br.evil.test/manifest.webmanifest'}], false],
    [[{platform: 'webapp', url: 'https://axecloud.com.br/manifest.webmanifest'}], true],
    [[{platform: 'webapp', id: 'https://axecloud.com.br/'}], true],
    [[{platform: 'play', id: 'https://axecloud.com.br/'}], false],
  ] as const) {
    mockProperty(t, globalThis, 'navigator', {getInstalledRelatedApps: async () => apps});
    assert.equal(await isInstalledRelatedWebApp(), installed);
  }
});

test('PWA: ambos os builds capturam evento antes da sessão e os menus têm acesso permanente', () => {
  const tags = pilotPwaPlugin().transformIndexHtml();
  assert.ok(tags.some(tag => tag.tag === 'script' && tag.injectTo === 'head-prepend'));
  for (const file of ['scripts/build-pilot-interface.mjs', 'scripts/build-member-pilot.mjs']) {
    assert.match(readFileSync(file, 'utf8'), /pilotPwaPlugin\(\)/);
  }
  const manager = readFileSync('design-systems/menu-local-20261029/main.tsx', 'utf8');
  assert.match(manager, /<PwaInstallAction iconSize=\{17\} \/>/);
  const member = readFileSync('design-systems/member-pilot-20261102/main.tsx', 'utf8');
  assert.match(member, /const menu=.*<PwaInstallAction\/>/);
  for (const source of [manager, member]) assert.match(source, /initPilotPwa\(\)/);
});
