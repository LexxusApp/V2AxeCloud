import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import {
  REMEMBER_EMAIL_KEY,
  clearRememberedLoginEmail,
  collectRememberedLoginEmailFromStorage,
  readRememberedLoginEmail,
  restoreRememberedLoginEmailToStorage,
  writeRememberedLoginEmail,
  readRememberLoginPreference,
  writeRememberLoginPreference,
} from '../src/lib/loginRemember.ts';
import { collectClientUiPrefsFromStorage, restoreClientUiPrefsToStorage } from '../src/lib/notificationPrefs.ts';

class MemoryStorage {
  values = new Map<string, string>();
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
});
afterEach(() => {
  for (const [key, descriptor] of [['window', oldWindow], ['localStorage', oldStorage]] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

test('e-mail lembrado pode ser relido sem depender de autenticação', () => {
  writeRememberedLoginEmail('  teste@example.com  ');
  assert.equal(readRememberedLoginEmail(), 'teste@example.com');
  assert.deepEqual([...storage.values], [[REMEMBER_EMAIL_KEY, 'teste@example.com']]);
});

test('logout preserva o e-mail e remove a sessão', () => {
  writeRememberedLoginEmail('teste@example.com');
  storage.setItem('sb-session', 'token-de-teste');
  const email = collectRememberedLoginEmailFromStorage();
  storage.clear();
  restoreRememberedLoginEmailToStorage(email);
  assert.equal(readRememberedLoginEmail(), 'teste@example.com');
  assert.equal(storage.getItem('sb-session'), null);
});

test('limpeza de sessão expirada preserva o e-mail pelas preferências de UI', () => {
  writeRememberedLoginEmail('teste@example.com');
  storage.setItem('sb-session', 'token-de-teste');
  storage.setItem('dados-da-casa', 'privado');
  storage.setItem('axecloud_notif_read_v2', '["aviso"]');
  const prefs = collectClientUiPrefsFromStorage();
  storage.clear();
  restoreClientUiPrefsToStorage(prefs);
  assert.equal(readRememberedLoginEmail(), 'teste@example.com');
  assert.equal(storage.getItem('axecloud_notif_read_v2'), '["aviso"]');
  assert.equal(storage.getItem('sb-session'), null);
  assert.equal(storage.getItem('dados-da-casa'), null);
});

test('desmarcar a opção remove o e-mail e a limpeza da sessão não o restaura', () => {
  writeRememberedLoginEmail('teste@example.com');
  clearRememberedLoginEmail();
  const prefs = collectClientUiPrefsFromStorage();
  storage.clear();
  restoreClientUiPrefsToStorage(prefs);
  assert.equal(readRememberedLoginEmail(), null);
});

test('armazenamento bloqueado não impede o uso da tela', () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('bloqueado'); } });
  assert.doesNotThrow(() => writeRememberedLoginEmail('teste@example.com'));
  assert.equal(readRememberedLoginEmail(), null);
  assert.doesNotThrow(() => clearRememberedLoginEmail());
  assert.doesNotThrow(() => writeRememberLoginPreference(false));
  assert.equal(readRememberLoginPreference(), true);
});

test('a escolha de não lembrar permanece após recarregar e limpar a sessão', () => {
  assert.equal(readRememberLoginPreference(), true);
  writeRememberedLoginEmail('teste@example.com');
  writeRememberLoginPreference(false);
  assert.equal(readRememberedLoginEmail(), null);
  assert.equal(readRememberLoginPreference(), false);
  const prefs = collectClientUiPrefsFromStorage();
  storage.clear();
  restoreClientUiPrefsToStorage(prefs);
  assert.equal(readRememberLoginPreference(), false);
  assert.equal(readRememberedLoginEmail(), null);
  writeRememberLoginPreference(true);
  assert.equal(readRememberLoginPreference(), true);
});
