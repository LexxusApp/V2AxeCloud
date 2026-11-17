import test from 'node:test';
import assert from 'node:assert/strict';
import { isRecoverableChunkError, hardRefreshFromStaleBundle, MAX_STALE_BOOT_RETRIES } from '../src/lib/urlHygiene.js';

test('reconhece incompatibilidade de exports de um chunk sem confundir erros comuns', () => {
  assert.equal(isRecoverableChunkError(new SyntaxError("The requested module './MatrizEditorialLayout-CzzGENKO.js' does not provide an export named 'M'")), true);
  assert.equal(isRecoverableChunkError(new TypeError('Failed to fetch dynamically imported module')), true);
  assert.equal(isRecoverableChunkError(new Error('CPF inválido. Confira os 11 dígitos.')), false);
  assert.equal(isRecoverableChunkError(new Error('Cannot read properties of undefined')), false);
});

test('recuperação de chunks mantém rota e limita tentativas sem limpar autenticação', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const storage = new Map<string, string>();
  const navigations: string[] = [];
  try {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: {
      href: 'https://axecloud.com.br/terreiro/candomble-de-angola?origem=google#perfil',
      replace: (url: string) => navigations.push(url),
    } } });
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
      getItem: (key: string) => storage.get(key) || null,
      setItem: (key: string, value: string) => storage.set(key, value),
    } });
    for (let n = 0; n < MAX_STALE_BOOT_RETRIES; n++) assert.equal(hardRefreshFromStaleBundle(), true);
    assert.equal(hardRefreshFromStaleBundle(), false);
    assert.equal(navigations.length, MAX_STALE_BOOT_RETRIES);
    for (const url of navigations) assert.match(url, /^\/terreiro\/candomble-de-angola\?origem=google&_boot=\d+#perfil$/);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (previousStorage) Object.defineProperty(globalThis, 'sessionStorage', previousStorage);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
  }
});
